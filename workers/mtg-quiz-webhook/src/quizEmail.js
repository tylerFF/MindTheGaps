/**
 * MindtheGaps — Quiz Results Email
 *
 * Sends a personalized email to the prospect after quiz completion.
 * The email mirrors the results page content so they can book the
 * scan later even if they close the browser.
 *
 * Public API:
 *   sendQuizResultsEmail(env, data)  → Promise<void>
 *   buildQuizResultsEmail(data)      → { subject, html }
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOGO_URL = 'https://mtg-pages-3yo.pages.dev/assets/mindthegaps-logo.png';

const PILLAR_COLORS = {
  Acquisition: { color: '#2e86ab', bg: '#e3f2fd' },
  Conversion:  { color: '#a23b72', bg: '#fce4ec' },
  Retention:   { color: '#f18f01', bg: '#fff3e0' },
};

const DEFAULT_STRIPE_URL = 'https://book.stripe.com/test_bJebJ28Jl30W3yL8Q81sQ01';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape HTML entities to prevent XSS in email clients.
 */
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert markdown bold (**text**) to <strong> tags.
 */
function boldToHtml(str) {
  if (!str) return '';
  return escapeHtml(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// ---------------------------------------------------------------------------
// Email builder
// ---------------------------------------------------------------------------

/**
 * Build the quiz results email content.
 *
 * @param {object} data
 * @param {string} data.firstName
 * @param {string} data.email
 * @param {string} data.businessName
 * @param {string} data.industry
 * @param {string} data.location
 * @param {string} data.teamSize
 * @param {string} data.primaryGap
 * @param {number} data.baselineScore
 * @param {string} data.primaryGapStatement
 * @param {string} data.subDiagnosisDisplay
 * @param {string} data.keySignalsLine
 * @param {string} data.costOfLeak
 * @param {string} data.costOfLeakAdvice
 * @param {string[]} data.fastestNextSteps
 * @param {boolean} data.eligible
 * @param {string} [data.fixFirstReason]
 * @param {string} [data.fixFirstAdvice]
 * @param {string} [data.stripeCheckoutUrl]
 * @returns {{ subject: string, html: string }}
 */
function buildQuizResultsEmail(data) {
  const name = escapeHtml(data.firstName || '');
  const business = escapeHtml(data.businessName || '');
  const industry = escapeHtml(data.industry || '');
  const location = escapeHtml(data.location || '');
  const teamSize = escapeHtml(data.teamSize || '');
  const gap = data.primaryGap || 'Conversion';
  const score = data.baselineScore != null ? data.baselineScore : '—';
  const pillar = PILLAR_COLORS[gap] || PILLAR_COLORS.Conversion;
  const stripeUrl = data.stripeCheckoutUrl || DEFAULT_STRIPE_URL;

  const subject = business
    ? `Your Growth Gap Results — ${data.businessName}`
    : 'Your Growth Gap Results';

  // Personalization details (only show non-empty ones)
  const details = [];
  if (business) details.push(`<strong>Business:</strong> ${business}`);
  if (industry) details.push(`<strong>Industry:</strong> ${industry}`);
  if (location) details.push(`<strong>Location:</strong> ${location}`);
  if (teamSize) details.push(`<strong>Team size:</strong> ${teamSize}`);
  const detailsHtml = details.length > 0
    ? `<p style="font-size:14px;color:#555;margin:12px 0 0 0;word-wrap:break-word;">${details.join(' · ')}</p>`
    : '';

  // Sub-diagnosis section
  const subDiagHtml = data.subDiagnosisDisplay
    ? `<div style="padding:12px 16px;background:#f8f9fa;border-left:3px solid ${pillar.color};border-radius:0 6px 6px 0;margin:16px 0 0 0;font-size:15px;color:#333;">${escapeHtml(data.subDiagnosisDisplay)}</div>`
    : '';

  // Key signals
  const signalsHtml = data.keySignalsLine
    ? `<p style="font-size:14px;font-style:italic;color:#555;margin:16px 0 0 0;">${escapeHtml(data.keySignalsLine)}</p>`
    : '';

  // Next steps list
  const stepsHtml = (data.fastestNextSteps || [])
    .map(s => `<li style="padding:6px 0;font-size:15px;color:#333;">${escapeHtml(s)}</li>`)
    .join('');

  // CTA section
  let ctaHtml;
  if (data.eligible) {
    ctaHtml = `
      <td style="background:#fff;border-radius:12px;padding:28px 24px;text-align:center;">
        <h2 style="font-size:20px;font-weight:700;color:#16213e;margin:0 0 8px 0;">Ready for Your Personalized Plan?</h2>
        <p style="font-size:16px;font-weight:700;color:#1a1a2e;margin:0 0 4px 0;">MindtheGaps 45-Minute Growth Scan</p>
        <p style="font-size:15px;font-weight:700;color:#1a1a2e;margin:0 0 16px 0;">CA$295.00</p>
        <hr style="border:none;border-top:1px solid #e2e6ea;margin:0 0 16px 0;">
        <p style="font-size:14px;color:#555;margin:0 0 16px 0;">A facilitated 45-minute working session to confirm your biggest growth gap, choose the one lever to fix first, and map the next 60 days with confidence. Within 24 hours after human review, you\u2019ll receive a personalized 1-page action plan you can use right away.</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;text-align:left;">
          <tr><td style="padding:4px 0;font-size:14px;color:#333;"><span style="color:#28a745;font-weight:700;">&#10003;</span>&nbsp; One clear lever to focus on</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:#333;"><span style="color:#28a745;font-weight:700;">&#10003;</span>&nbsp; 6 actions with owners + 14 / 30 / 60-day due dates</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:#333;"><span style="color:#28a745;font-weight:700;">&#10003;</span>&nbsp; A weekly scoreboard with 2&#8211;4 key metrics</td></tr>
        </table>
        <p style="font-size:13px;color:#666;margin:0 0 6px 0;">No logins. No customer lists. No sensitive uploads. If you do not know your exact numbers, ranges are fine.</p>
        <p style="font-size:13px;color:#16213e;font-weight:600;margin:0 0 20px 0;">Best for Owner/GM, or a lead who owns growth and can act on the plan.</p>
        <a href="${escapeHtml(stripeUrl)}" style="display:inline-block;padding:14px 32px;border-radius:8px;background:${pillar.color};color:#fff;text-decoration:none;font-weight:600;font-size:16px;">Book the 45-Minute Growth Gap Scan &mdash; CAD $295</a>
      </td>`;
  } else {
    const fixReason = escapeHtml(data.fixFirstReason || '');
    const fixAdvice = escapeHtml(data.fixFirstAdvice || '');
    ctaHtml = `
      <td style="background:#fff8e1;border:1px solid #ffe082;border-radius:12px;padding:24px;">
        <p style="font-size:15px;font-weight:600;color:#e65100;margin:0 0 8px 0;">Before We Can Book Your Scan</p>
        ${fixReason ? `<p style="font-size:14px;color:#555;margin:0 0 8px 0;">${fixReason}</p>` : ''}
        ${fixAdvice ? `<p style="font-size:14px;color:#555;margin:0;">${fixAdvice}</p>` : ''}
      </td>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#1a1a2e;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- Logo + Header -->
  <tr><td style="text-align:center;padding:0 0 24px 0;">
    <img src="${LOGO_URL}" alt="MindtheGaps" width="180" style="display:block;margin:0 auto 16px;width:180px;height:auto;">
    <h1 style="font-size:22px;font-weight:700;color:#16213e;margin:0 0 4px 0;">Your Growth Gap Results</h1>
    <p style="font-size:14px;color:#6c757d;margin:0;">MindtheGaps Business Diagnostic</p>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;">
    <p style="font-size:16px;color:#1a1a2e;margin:0 0 8px 0;">Hi${name ? ' ' + name : ''},</p>
    <p style="font-size:15px;color:#444;margin:0;">Here are the results from your MindtheGaps Growth Gap Quiz${business ? ' for <strong>' + business + '</strong>' : ''}.</p>
    ${detailsHtml}
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- Primary Gap Card -->
  <tr><td style="background:#fff;border-radius:12px;padding:24px;">
    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#6c757d;margin:0 0 8px 0;">Primary Growth Gap</p>
    <p style="font-size:20px;font-weight:600;line-height:1.4;color:#1a1a2e;margin:0 0 12px 0;">${boldToHtml(data.primaryGapStatement || '')}</p>
    <span style="display:inline-block;padding:6px 14px;border-radius:20px;background:${pillar.bg};color:${pillar.color};font-size:14px;font-weight:600;">Gap Score: ${score}/100</span>
    ${subDiagHtml}
    ${signalsHtml}
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- Cost of Leak -->
  <tr><td style="background:#fff;border-radius:12px;padding:24px;">
    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#6c757d;margin:0 0 8px 0;">What This Costs You</p>
    <p style="font-size:16px;font-weight:600;color:#c0392b;margin:0 0 8px 0;">${escapeHtml(data.costOfLeak || '')}</p>
    <p style="font-size:14px;color:#555;margin:0;">${escapeHtml(data.costOfLeakAdvice || '')}</p>
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- Fastest Next Steps -->
  <tr><td style="background:#fff;border-radius:12px;padding:24px;">
    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#6c757d;margin:0 0 8px 0;">Fastest Next Steps</p>
    <ul style="list-style:none;padding:0;margin:0;">${stepsHtml}</ul>
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- CTA -->
  <tr>${ctaHtml}</tr>

  <!-- Footer -->
  <tr><td style="text-align:center;padding:24px 0 0 0;">
    <p style="font-size:13px;color:#6c757d;margin:0 0 4px 0;">Questions? Reply to this email.</p>
    <p style="font-size:13px;color:#999;margin:0;">MindtheGaps</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Send helper
// ---------------------------------------------------------------------------

/**
 * Send the quiz results email to the prospect.
 * Silently skips if RESEND_API_KEY is not configured.
 */
async function sendQuizResultsEmail(env, data) {
  if (!env || !env.RESEND_API_KEY) {
    return; // Skip silently — same pattern as scan notifications
  }

  if (!data || !data.email) {
    console.error('Quiz results email skipped: no recipient email');
    return;
  }

  const { subject, html } = buildQuizResultsEmail(data);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'MindtheGaps <notifications@mindthegaps.biz>',
      to: [data.email],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API returned ${response.status}: ${errorText}`);
  }
}

// ---------------------------------------------------------------------------
// Scan worksheet prefill URL
// ---------------------------------------------------------------------------

const SCAN_FORM_URL = 'https://form.jotform.com/260435948553162';

/**
 * Build a JotForm prefill URL for the scan worksheet.
 * Uses field `name` attributes as URL param keys (JotForm prefill convention).
 */
function buildScanPrefillUrl(data) {
  const params = new URLSearchParams();
  if (data.firstName) params.set('scanFirstName', data.firstName);
  if (data.email) params.set('contactEmail', data.email);
  if (data.businessName) params.set('scanBusinessName', data.businessName);
  if (data.industry) params.set('scanIndustry', data.industry);
  if (data.primaryGap) {
    params.set('quizPrimaryGap', data.primaryGap);
    params.set('primaryGap', data.primaryGap);
  }
  const qs = params.toString();
  return qs ? `${SCAN_FORM_URL}?${qs}` : SCAN_FORM_URL;
}

// ---------------------------------------------------------------------------
// Marc notification — quiz answers + scoring summary
// ---------------------------------------------------------------------------

const QUESTION_LABELS = {
  V1: 'Biggest priority',
  V2: 'Monthly leads',
  V3: 'Response time',
  V4: 'Show rate',
  V5: 'Lead sources',
  A1: 'Last 20 leads — fit',
  C1: 'Lead owner',
  C2: 'Time to first meeting',
  C3: 'Biggest reason leads don\'t book',
  R1: 'Account reviews',
  R2: 'Existing client revenue',
  R3: 'Revenue split',
};

/**
 * Build a simple notification email for Marc with quiz answers and results.
 */
function buildQuizNotificationEmail(data) {
  const name = escapeHtml(data.firstName || 'Unknown');
  const business = escapeHtml(data.businessName || '');
  const email = escapeHtml(data.email || '');
  const gap = escapeHtml(data.primaryGap || '');
  const subDiag = escapeHtml(data.subDiagnosis || 'None');
  const score = data.baselineScore != null ? data.baselineScore : '—';

  const answersRows = Object.entries(data.answers || {})
    .map(([key, value]) => {
      const label = QUESTION_LABELS[key] || key;
      return `<tr><td style="padding:4px 12px 4px 0;font-size:14px;color:#555;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:14px;color:#1a1a2e;font-weight:500;">${escapeHtml(value)}</td></tr>`;
    })
    .join('');

  const pillarTotals = data.pillarTotals || {};
  const totalsLine = Object.entries(pillarTotals)
    .map(([p, t]) => `${escapeHtml(p)}: ${t}`)
    .join(' · ');

  const scanPrefillUrl = buildScanPrefillUrl(data);
  const subject = `Quiz submission: ${data.businessName || data.firstName || email} → ${gap}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;background:#f8f9fa;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;">
  <h2 style="font-size:18px;margin:0 0 16px 0;">New Quiz Submission</h2>
  <table style="margin-bottom:16px;">
    <tr><td style="padding:2px 12px 2px 0;font-size:14px;color:#555;">Name:</td><td style="font-size:14px;">${name}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;font-size:14px;color:#555;">Email:</td><td style="font-size:14px;">${email}</td></tr>
    ${business ? `<tr><td style="padding:2px 12px 2px 0;font-size:14px;color:#555;">Business:</td><td style="font-size:14px;">${business}</td></tr>` : ''}
  </table>

  <h3 style="font-size:15px;margin:0 0 8px 0;">Result</h3>
  <p style="font-size:14px;margin:0 0 4px 0;"><strong>Primary Gap:</strong> ${gap} (${score}/100)</p>
  <p style="font-size:14px;margin:0 0 4px 0;"><strong>Sub-diagnosis:</strong> ${subDiag}</p>
  <p style="font-size:14px;margin:0 0 16px 0;"><strong>Pillar totals:</strong> ${escapeHtml(totalsLine)}</p>

  <div style="margin:0 0 16px 0;padding:12px 16px;background:#e3f2fd;border-radius:6px;">
    <p style="font-size:14px;margin:0 0 8px 0;font-weight:600;">Scan Worksheet (prefilled)</p>
    <a href="${escapeHtml(scanPrefillUrl)}" style="font-size:14px;color:#2e86ab;word-break:break-all;">${escapeHtml(scanPrefillUrl)}</a>
  </div>

  <h3 style="font-size:15px;margin:0 0 8px 0;">Answers</h3>
  <table style="border-collapse:collapse;">${answersRows}</table>
</div>
</body></html>`;

  return { subject, html };
}

/**
 * Send quiz notification to Marc.
 * Silently skips if MARC_EMAIL or RESEND_API_KEY is not configured.
 */
async function sendQuizNotificationToMarc(env, data) {
  if (!env || !env.RESEND_API_KEY || !env.MARC_EMAIL) {
    return;
  }

  const { subject, html } = buildQuizNotificationEmail(data);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'MindtheGaps <notifications@mindthegaps.biz>',
      to: [env.MARC_EMAIL],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API returned ${response.status}: ${errorText}`);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  sendQuizResultsEmail,
  buildQuizResultsEmail,
  sendQuizNotificationToMarc,
  buildQuizNotificationEmail,
  buildScanPrefillUrl,
  _internal: {
    escapeHtml,
    boldToHtml,
    PILLAR_COLORS,
    QUESTION_LABELS,
  },
};
