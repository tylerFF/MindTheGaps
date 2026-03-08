/**
 * MindtheGaps — Weekly Completion Report (Cloudflare Worker)
 *
 * On-demand report: quiz completions by cohort_id, broken down by variant_id.
 *
 * Usage:
 *   GET /                → last week (Mon–Sun), JSON
 *   GET /?from=2026-02-24&to=2026-03-02  → custom date range
 *   GET /?format=html    → HTML-formatted table (default: json)
 *   GET /?token=SECRET   → auth token (required if REPORT_SECRET is set)
 *
 * Environment bindings:
 *   HUBSPOT_API_KEY  — HubSpot private app token
 *   REPORT_SECRET    — Bearer token to protect the endpoint (optional)
 */

const HUBSPOT_SEARCH_URL = 'https://api.hubapi.com/crm/v3/objects/contacts/search';

const PROPERTIES_TO_FETCH = [
  'email',
  'mtg_first_name',
  'mtg_last_name',
  'mtg_quiz_completed',
  'mtg_quiz_completed_at',
  'mtg_cohort_id',
  'mtg_variant_id',
  'mtg_source_channel',
  'mtg_primary_gap',
  'mtg_business_name',
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getLastWeekRange(refDate) {
  const d = new Date(refDate);
  const day = d.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(d);
  thisMonday.setUTCDate(d.getUTCDate() - daysSinceMonday);
  thisMonday.setUTCHours(0, 0, 0, 0);
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
  lastSunday.setUTCHours(23, 59, 59, 999);
  return { from: lastMonday, to: lastSunday };
}

function parseDate(str) {
  const d = new Date(str + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  return d;
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// HubSpot search — paginated fetch of completed-quiz contacts in date range
// ---------------------------------------------------------------------------

async function searchCompletedContacts(apiKey, from, to) {
  const allContacts = [];
  let after = undefined;
  const fromMs = from.getTime();
  const toMs = to.getTime();

  for (let page = 0; page < 20; page++) {
    const body = {
      filterGroups: [{
        filters: [
          { propertyName: 'mtg_quiz_completed', operator: 'EQ', value: 'true' },
          { propertyName: 'mtg_quiz_completed_at', operator: 'GTE', value: String(fromMs) },
          { propertyName: 'mtg_quiz_completed_at', operator: 'LTE', value: String(toMs) },
        ],
      }],
      properties: PROPERTIES_TO_FETCH,
      limit: 100,
      sorts: [{ propertyName: 'mtg_quiz_completed_at', direction: 'ASCENDING' }],
    };
    if (after) body.after = after;

    const resp = await fetch(HUBSPOT_SEARCH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`HubSpot search failed (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    if (data.results) allContacts.push(...data.results);
    if (data.paging && data.paging.next && data.paging.next.after) {
      after = data.paging.next.after;
    } else {
      break;
    }
  }
  return allContacts;
}

// ---------------------------------------------------------------------------
// Aggregate: group by cohort → variant, with contact details
// ---------------------------------------------------------------------------

function buildReport(contacts, from, to) {
  const cohorts = {};
  let totalCompletions = 0;

  for (const contact of contacts) {
    const props = contact.properties || {};
    const cohortId = props.mtg_cohort_id || '(no cohort)';
    const variantId = props.mtg_variant_id || '(no variant)';
    const email = props.email || '(unknown)';
    const primaryGap = props.mtg_primary_gap || '';
    const sourceChannel = props.mtg_source_channel || '';
    const completedAt = props.mtg_quiz_completed_at || '';
    const firstName = props.mtg_first_name || '';
    const lastName = props.mtg_last_name || '';
    const businessName = props.mtg_business_name || '';

    if (!cohorts[cohortId]) cohorts[cohortId] = { total: 0, variants: {} };
    cohorts[cohortId].total++;
    if (!cohorts[cohortId].variants[variantId]) {
      cohorts[cohortId].variants[variantId] = { count: 0, contacts: [] };
    }
    cohorts[cohortId].variants[variantId].count++;
    cohorts[cohortId].variants[variantId].contacts.push({
      email, firstName, lastName, businessName, primaryGap, sourceChannel, completedAt,
    });
    totalCompletions++;
  }

  return {
    report: 'MTG Weekly Quiz Completion Report',
    period: { from: fmtDate(from), to: fmtDate(to) },
    totalCompletions,
    cohorts,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// HTML renderer
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function reportToHtml(report) {
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>MTG Quiz Completion Report</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:960px;margin:40px auto;padding:0 20px;color:#1a1a1a}
h1{color:#0f4c5c;border-bottom:2px solid #0f4c5c;padding-bottom:8px}
h2{color:#2d6a4f;margin-top:32px}
h3{color:#40916c;margin-top:20px}
.meta{color:#666;font-size:14px;margin-bottom:24px}
.summary{background:#f0f7f4;border-left:4px solid #2d6a4f;padding:12px 16px;margin:16px 0;border-radius:4px}
.adjust{background:#fffbeb;border:1px solid #fde68a;padding:10px 16px;margin:12px 0;border-radius:4px;font-size:13px}
code{background:#f3f4f6;padding:2px 6px;border-radius:3px;font-size:13px}
table{border-collapse:collapse;width:100%;margin:12px 0}
th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;font-size:14px}
th{background:#f5f5f5;font-weight:600}
tr:nth-child(even){background:#fafafa}
.empty{color:#999;font-style:italic}
</style></head><body>`;

  html += `<h1>MTG Quiz Completion Report</h1>`;
  html += `<div class="meta">Period: ${report.period.from} to ${report.period.to} &nbsp;|&nbsp; Generated: ${report.generatedAt.slice(0, 16).replace('T', ' ')} UTC</div>`;
  html += `<div class="summary"><strong>Total completions:</strong> ${report.totalCompletions}</div>`;
  html += `<div class="adjust"><strong>Adjust date range:</strong> Add <code>?from=YYYY-MM-DD&to=YYYY-MM-DD</code> to the URL. Default is last Monday\u2013Sunday.</div>`;

  if (report.totalCompletions === 0) {
    html += `<p class="empty">No quiz completions found in this period.</p>`;
  } else {
    const cohortKeys = Object.keys(report.cohorts).sort();
    for (const cohortId of cohortKeys) {
      const cohort = report.cohorts[cohortId];
      html += `<h2>Cohort: ${esc(cohortId)} (${cohort.total} completion${cohort.total !== 1 ? 's' : ''})</h2>`;

      const variantKeys = Object.keys(cohort.variants).sort();
      for (const variantId of variantKeys) {
        const variant = cohort.variants[variantId];
        html += `<h3>Variant: ${esc(variantId)} (${variant.count})</h3>`;
        html += `<table><tr><th>Email</th><th>Name</th><th>Business</th><th>Primary Gap</th><th>Source</th><th>Completed</th></tr>`;
        for (const c of variant.contacts) {
          const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || '\u2014';
          const completed = c.completedAt ? c.completedAt.slice(0, 16).replace('T', ' ') : '';
          html += `<tr><td>${esc(c.email)}</td><td>${esc(name)}</td><td>${esc(c.businessName)}</td><td>${esc(c.primaryGap)}</td><td>${esc(c.sourceChannel)}</td><td>${esc(completed)}</td></tr>`;
        }
        html += `</table>`;
      }
    }
  }

  html += `</body></html>`;
  return html;
}

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handleRequest(request, env) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  // Auth check (optional — only enforced if REPORT_SECRET is set)
  if (env.REPORT_SECRET) {
    const authHeader = request.headers.get('Authorization') || '';
    const url = new URL(request.url);
    const tokenParam = url.searchParams.get('token');
    const token = authHeader.replace(/^Bearer\s+/i, '') || tokenParam || '';
    if (token !== env.REPORT_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }

  if (!env.HUBSPOT_API_KEY) {
    return new Response(JSON.stringify({ error: 'HUBSPOT_API_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  // Parse date range (default: last Monday–Sunday)
  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'json';
  let from, to;
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  if (fromParam && toParam) {
    from = parseDate(fromParam);
    to = parseDate(toParam);
    if (!from || !to) {
      return new Response(JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD.' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
    to.setUTCHours(23, 59, 59, 999);
  } else {
    const range = getLastWeekRange(new Date());
    from = range.from;
    to = range.to;
  }

  // Fetch + build report
  try {
    const contacts = await searchCompletedContacts(env.HUBSPOT_API_KEY, from, to);
    const report = buildReport(contacts, from, to);

    if (format === 'html') {
      return new Response(reportToHtml(report), {
        status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
      });
    }
    return new Response(JSON.stringify(report, null, 2), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    console.error('Report error:', err);
    return new Response(JSON.stringify({ error: 'Failed to generate report', details: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
}

export default { fetch: handleRequest };
