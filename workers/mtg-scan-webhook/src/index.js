/**
 * MindtheGaps — Scan Webhook Handler (Cloudflare Worker)
 *
 * Receives a JotForm scan worksheet submission, then:
 *   1. Parses contact info + scan data from the payload
 *   2. Validates email
 *   3. Runs stop rules — if stopped, notify Marc + write HubSpot + return
 *   4. Calculates confidence
 *   5. Generates plan deterministically (no AI)
 *   6. Builds DOCX
 *   7. Uploads to R2
 *   8. Writes everything to HubSpot
 *   9. Notifies Marc
 *
 * Environment bindings (set in wrangler.toml / dashboard):
 *   HUBSPOT_API_KEY, RESEND_API_KEY,
 *   R2_BUCKET, MARC_EMAIL, FROM_EMAIL
 */

const { checkStopRules } = require('./stopRules');
const { calculateConfidence } = require('./confidence');
const { generatePlan } = require('./planGenerator');
const { buildDocx } = require('./docxBuilder');
const { uploadPlan } = require('./storage');
const { notifyPlanReady, notifyStopRule } = require('./notifications');
const { createHubSpotClient } = require('../../shared/hubspot');
const { isValidEmail, normalizeEmail, sanitizeString } = require('../../shared/validation');
const { PILLARS, BASELINE_FIELDS } = require('../../shared/constants');

// ---------------------------------------------------------------------------
// JotForm field mapping — placeholder names, swap when form is built
// ---------------------------------------------------------------------------

const JOTFORM_SCAN_FIELD_MAP = {
  // Form ID: 260435948553162 — field names are q{QID}_{name}
  contact: {
    q2_contactEmail: 'email',
    q3_scanFirstName: 'firstName',
    q4_scanBusinessName: 'businessName',
    q5_scanIndustry: 'industry',
    q6_scanPhone: 'phone',
  },
  scan: {
    q9_primaryGap: 'primaryGap',
    q7_quizPrimaryGap: 'quizPrimaryGap',
    q10_gapChangeReason: 'gapChangeReason',
  },
  // Sub-path: one per pillar, extracted based on primaryGap
  subPathByPillar: {
    Conversion: 'q11_subPathConversion',
    Acquisition: 'q12_subPathAcquisition',
    Retention: 'q13_subPathRetention',
  },
  // One Lever: one per pillar, extracted based on primaryGap
  oneLeverByPillar: {
    Conversion: 'q36_oneLeverConversion',
    Acquisition: 'q37_oneLeverAcquisition',
    Retention: 'q38_oneLeverRetention',
  },
  oneLeverSentence: 'q39_oneLeverSentence',
  // Baseline fields per pillar
  baseline: {
    q15_convInboundLeads: 'conv_inbound_leads',
    q16_convFirstResponseTime: 'conv_first_response_time',
    q17_convLeadToBooked: 'conv_lead_to_booked',
    q18_convBookedToShow: 'conv_booked_to_show',
    q19_convTimeToFirstAppt: 'conv_time_to_first_appointment',
    q20_convQuoteSentTimeline: 'conv_quote_sent_timeline',
    q21_convQuoteToClose: 'conv_quote_to_close',
    q22_acqInboundLeads: 'acq_inbound_leads',
    q23_acqTopSourceDep: 'acq_top_source_dependence',
    q24_acqPctFromTopSource: 'acq_pct_from_top_source',
    q25_acqCallsAnsweredLive: 'acq_calls_answered_live',
    q26_acqWebsiteCaptureFriction: 'acq_website_capture_friction',
    q27_acqReviewsPerMonth: 'acq_reviews_per_month',
    q28_acqReferralIntrosPerMonth: 'acq_referral_intros_per_month',
    q29_retPctRevenueRepeat: 'ret_pct_revenue_repeat',
    q30_retPctRevenueReferrals: 'ret_pct_revenue_referrals',
    q31_retRebookScheduling: 'ret_rebook_scheduling',
    q32_retReviewsPerMonth: 'ret_reviews_per_month',
    q33_retFollowUpTime: 'ret_follow_up_time',
    q34_retCheckInRhythm: 'ret_check_in_rhythm',
  },
  // Actions: q{QID}_{name} for each of 6 slots
  actions: {
    1: { desc: 'q41_action1Desc', owner: 'q42_action1Owner', due: 'q43_action1Due' },
    2: { desc: 'q44_action2Desc', owner: 'q45_action2Owner', due: 'q46_action2Due' },
    3: { desc: 'q47_action3Desc', owner: 'q48_action3Owner', due: 'q49_action3Due' },
    4: { desc: 'q50_action4Desc', owner: 'q51_action4Owner', due: 'q52_action4Due' },
    5: { desc: 'q53_action5Desc', owner: 'q54_action5Owner', due: 'q55_action5Due' },
    6: { desc: 'q56_action6Desc', owner: 'q57_action6Owner', due: 'q58_action6Due' },
  },
  // Metrics: one checkbox field per pillar
  metricsByPillar: {
    Conversion: 'q60_metricsConversion',
    Acquisition: 'q61_metricsAcquisition',
    Retention: 'q62_metricsRetention',
  },
  // Constraints
  constraints: {
    1: 'q64_constraint1',
    2: 'q65_constraint2',
    3: 'q66_constraint3',
  },
};

// ---------------------------------------------------------------------------
// QID → full field name map (for JotForm rawRequest with numeric keys)
// Built once at module load from JOTFORM_SCAN_FIELD_MAP
// ---------------------------------------------------------------------------

const QID_TO_FIELD = {};
function registerFields(obj) {
  for (const key of Object.values(typeof obj === 'object' ? obj : {})) {
    const match = typeof key === 'string' && key.match(/^q(\d+)_/);
    if (match) QID_TO_FIELD[match[1]] = key;
  }
}
function registerFieldKeys(obj) {
  for (const key of Object.keys(typeof obj === 'object' ? obj : {})) {
    const match = key.match(/^q(\d+)_/);
    if (match) QID_TO_FIELD[match[1]] = key;
  }
}
// Register all known field names
registerFieldKeys(JOTFORM_SCAN_FIELD_MAP.contact);
registerFieldKeys(JOTFORM_SCAN_FIELD_MAP.scan);
registerFieldKeys(JOTFORM_SCAN_FIELD_MAP.baseline);
registerFields(JOTFORM_SCAN_FIELD_MAP.subPathByPillar);
registerFields(JOTFORM_SCAN_FIELD_MAP.oneLeverByPillar);
{ const m = JOTFORM_SCAN_FIELD_MAP.oneLeverSentence.match(/^q(\d+)_/); if (m) QID_TO_FIELD[m[1]] = JOTFORM_SCAN_FIELD_MAP.oneLeverSentence; }
for (const slot of Object.values(JOTFORM_SCAN_FIELD_MAP.actions)) {
  for (const fieldName of Object.values(slot)) {
    const match = fieldName.match(/^q(\d+)_/);
    if (match) QID_TO_FIELD[match[1]] = fieldName;
  }
}
registerFields(JOTFORM_SCAN_FIELD_MAP.metricsByPillar);
registerFields(JOTFORM_SCAN_FIELD_MAP.constraints);

/**
 * Normalize payload keys: JotForm rawRequest uses numeric QIDs ("2", "9", etc.)
 * but our field map uses "q2_contactEmail", "q9_primaryGap", etc.
 * This adds the full field name for any numeric key found in the payload.
 */
function normalizePayloadKeys(payload) {
  for (const [qid, fullKey] of Object.entries(QID_TO_FIELD)) {
    if (payload[qid] !== undefined && payload[fullKey] === undefined) {
      payload[fullKey] = payload[qid];
    }
  }
  return payload;
}

// ---------------------------------------------------------------------------
// CORS configuration
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function corsResponse(body, status = 200) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function errorResponse(message, status = 400) {
  return corsResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Payload parsing (same pattern as quiz webhook)
// ---------------------------------------------------------------------------

async function parsePayload(request) {
  const contentType = request.headers.get('Content-Type') || '';
  let payload;

  if (contentType.includes('form')) {
    const formData = await request.formData();
    const flat = {};
    for (const [key, value] of formData.entries()) {
      flat[key] = value;
    }
    if (flat.rawRequest) {
      try {
        const raw = JSON.parse(flat.rawRequest);
        payload = { ...flat, ...raw };
      } catch { payload = flat; }
    } else {
      payload = flat;
    }
  } else if (contentType.includes('json')) {
    const json = await request.json();
    if (json.rawRequest && typeof json.rawRequest === 'string') {
      try { payload = JSON.parse(json.rawRequest); } catch { payload = json; }
    } else {
      payload = json;
    }
  } else {
    const text = await request.text();
    try { payload = JSON.parse(text); } catch { payload = {}; }
  }

  // Normalize JotForm numeric QID keys ("2", "9") → full field names ("q2_contactEmail", "q9_primaryGap")
  return normalizePayloadKeys(payload);
}

// ---------------------------------------------------------------------------
// Extract contact info
// ---------------------------------------------------------------------------

function extractContactInfo(payload) {
  const info = {};
  for (const [jotformField, key] of Object.entries(JOTFORM_SCAN_FIELD_MAP.contact)) {
    const value = payload[jotformField];
    if (value !== undefined && value !== null && value !== '') {
      info[key] = sanitizeString(String(value));
    }
  }
  return info;
}

// ---------------------------------------------------------------------------
// Extract scan data from flat payload
// ---------------------------------------------------------------------------

function extractScanData(payload) {
  const scan = {};

  // Core scan fields
  for (const [jotformField, key] of Object.entries(JOTFORM_SCAN_FIELD_MAP.scan)) {
    const value = payload[jotformField];
    if (value !== undefined && value !== null) {
      scan[key] = String(value).trim();
    }
  }

  // Default primaryGap
  scan.primaryGap = scan.primaryGap || '';
  scan.quizPrimaryGap = scan.quizPrimaryGap || scan.primaryGap;
  scan.gapChangeReason = scan.gapChangeReason || '';

  // Sub-path: pick the field matching the confirmed primary gap
  const subPathField = JOTFORM_SCAN_FIELD_MAP.subPathByPillar[scan.primaryGap];
  scan.subPath = subPathField ? String(payload[subPathField] || '').trim() : '';

  // One lever: pick the field matching the confirmed primary gap
  const oneLeverField = JOTFORM_SCAN_FIELD_MAP.oneLeverByPillar[scan.primaryGap];
  scan.oneLever = oneLeverField ? String(payload[oneLeverField] || '').trim() : '';
  scan.oneLeverSentence = String(payload[JOTFORM_SCAN_FIELD_MAP.oneLeverSentence] || '').trim();

  // Baseline fields
  scan.baselineFields = {};
  for (const [jotformField, key] of Object.entries(JOTFORM_SCAN_FIELD_MAP.baseline)) {
    const value = payload[jotformField];
    if (value !== undefined && value !== null) {
      scan.baselineFields[key] = String(value).trim();
    }
  }

  // Actions (6 slots)
  scan.actions = [];
  for (let i = 1; i <= 6; i++) {
    const actionMap = JOTFORM_SCAN_FIELD_MAP.actions[i];
    // JotForm sends dates as objects: {"month":"02","day":"19","year":"2026","datetime":"..."}
    const rawDue = payload[actionMap.due];
    let dueDate = '';
    if (rawDue && typeof rawDue === 'object' && rawDue.year) {
      dueDate = rawDue.datetime || `${rawDue.year}-${rawDue.month}-${rawDue.day}`;
    } else {
      dueDate = String(rawDue || '').trim();
    }
    scan.actions.push({
      description: String(payload[actionMap.desc] || '').trim(),
      owner: String(payload[actionMap.owner] || '').trim(),
      dueDate,
    });
  }

  // Metrics: pick the checkbox field matching the confirmed primary gap
  scan.metrics = [];
  const metricsField = JOTFORM_SCAN_FIELD_MAP.metricsByPillar[scan.primaryGap];
  if (metricsField) {
    const metricsValue = payload[metricsField];
    if (metricsValue) {
      // JotForm sends checkboxes as arrays or newline/comma-separated strings
      if (Array.isArray(metricsValue)) {
        scan.metrics = metricsValue.filter(Boolean);
      } else {
        const parts = String(metricsValue).split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        scan.metrics = parts;
      }
    }
  }

  // Constraints
  scan.constraints = [];
  for (let i = 1; i <= 3; i++) {
    const field = JOTFORM_SCAN_FIELD_MAP.constraints[i];
    const value = payload[field];
    if (value && String(value).trim()) {
      scan.constraints.push(String(value).trim());
    }
  }

  return scan;
}

// ---------------------------------------------------------------------------
// HubSpot property builder
// ---------------------------------------------------------------------------

function buildHubSpotProperties(scanData, confidenceResult, planUrl, stopResult) {
  const props = {};

  // Scan metadata
  props.mtg_scan_completed = 'true';
  props.mtg_scan_completed_at = new Date().toISOString();
  props.mtg_scan_primary_gap_confirmed = scanData.primaryGap;
  props.mtg_scan_sub_path = scanData.subPath;
  props.mtg_scan_one_lever = scanData.oneLever;
  if (scanData.oneLeverSentence) {
    props.mtg_scan_one_lever_sentence = scanData.oneLeverSentence;
  }

  if (stopResult && stopResult.stopped) {
    props.mtg_scan_stop_reason = stopResult.reasons.join(' | ');
    props.mtg_plan_review_status = 'Manual Required';
    props.mtg_plan_generation_mode = 'Stopped';
    return props;
  }

  // Confidence
  if (confidenceResult) {
    props.mtg_scan_confidence = confidenceResult.level;
    props.mtg_confidence_not_sure_count = String(confidenceResult.notSureCount);
  }

  // Plan
  if (planUrl) {
    props.mtg_plan_draft_link = planUrl;
    props.mtg_plan_review_status = 'Pending';
    props.mtg_plan_drafted_at = new Date().toISOString();
    props.mtg_plan_status = 'Draft';
    props.mtg_plan_generation_mode = 'Auto';
  }

  return props;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GET /plans/* — serve DOCX files from R2
// ---------------------------------------------------------------------------

async function handlePlanDownload(request, env) {
  const url = new URL(request.url);
  const key = url.pathname.replace(/^\//, ''); // strip leading slash → "plans/email/ts.docx"

  if (!env.R2_BUCKET) {
    return new Response('Storage not configured', { status: 503 });
  }

  const object = await env.R2_BUCKET.get(key);
  if (!object) {
    return new Response('File not found', { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handleScanWebhook(request, env, ctx) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // GET /plans/* — serve DOCX downloads from R2
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/plans/')) {
        return handlePlanDownload(request, env);
      }
    } catch { /* not a valid absolute URL — fall through */ }
    return errorResponse('Method not allowed', 405);
  }

  // Only POST for webhook
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // 1. Parse payload
    const payload = await parsePayload(request);

    // 2. Extract contact info + scan data
    const contactInfo = extractContactInfo(payload);
    const scanData = extractScanData(payload);

    // 3. Validate email
    const rawEmail = contactInfo.email || payload.s_email || payload.email || '';
    const email = normalizeEmail(rawEmail);

    if (!isValidEmail(email)) {
      return errorResponse('A valid email address is required');
    }

    // 4. Run stop rules
    const stopResult = checkStopRules(scanData);

    if (stopResult.stopped) {
      // Write stop reason to HubSpot (non-blocking)
      const hubspotProps = buildHubSpotProperties(scanData, null, null, stopResult);

      if (env.HUBSPOT_API_KEY) {
        const writeStop = async () => {
          try {
            const client = createHubSpotClient(env.HUBSPOT_API_KEY);
            await client.upsertContact(email, hubspotProps);
          } catch (err) {
            console.error('HubSpot write failed (stop):', err.message);
          }
        };
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(writeStop());
        } else {
          await writeStop();
        }
      }

      // Notify Marc
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(notifyStopRule(env, {
          email,
          businessName: contactInfo.businessName,
          stopReasons: stopResult.reasons,
        }));
      } else {
        await notifyStopRule(env, {
          email,
          businessName: contactInfo.businessName,
          stopReasons: stopResult.reasons,
        });
      }

      return corsResponse({
        success: true,
        stopped: true,
        reasons: stopResult.reasons,
        email,
      });
    }

    // 5. Calculate confidence
    const confidenceResult = calculateConfidence(scanData.baselineFields, scanData.primaryGap);

    // 6. Generate plan (deterministic — no AI)
    const planContent = generatePlan(scanData, contactInfo, confidenceResult);

    // 7. Build DOCX
    const docxBuffer = await buildDocx(planContent, scanData, contactInfo, confidenceResult);

    // 8. Upload to R2 (skip if no bucket configured)
    let planUrl = null;
    if (env.R2_BUCKET) {
      const key = await uploadPlan(env, email, docxBuffer);
      // Build a real download URL using the worker's own hostname
      try {
        const workerUrl = new URL(request.url);
        planUrl = `${workerUrl.origin}/${key}`;
      } catch {
        planUrl = `/${key}`;
      }
    }

    // 9. Write to HubSpot (non-blocking)
    const hubspotProps = buildHubSpotProperties(scanData, confidenceResult, planUrl, null);
    let hubspotStatus = 'skipped';

    if (env.HUBSPOT_API_KEY) {
      const hubspotWrite = async () => {
        try {
          const client = createHubSpotClient(env.HUBSPOT_API_KEY);
          const result = await client.upsertContact(email, hubspotProps);
          hubspotStatus = result.created ? 'created' : 'updated';
        } catch (err) {
          console.error('HubSpot write failed:', err.message);
          hubspotStatus = 'error';
        }
      };
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(hubspotWrite());
      } else {
        await hubspotWrite();
      }
    }

    // 10. Notify Marc (non-blocking)
    if (planUrl) {
      const notifyCall = notifyPlanReady(env, {
        email,
        businessName: contactInfo.businessName,
        planUrl,
        confidence: confidenceResult.level,
      });
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(notifyCall);
      } else {
        await notifyCall;
      }
    }

    // 11. Return results
    return corsResponse({
      success: true,
      stopped: false,
      email,
      confidence: confidenceResult.level,
      planUrl,
      _meta: {
        hubspotStatus,
        hasPlan: !!planContent,
        hasDocx: !!docxBuffer,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Scan webhook error:', err);
    return errorResponse('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// Worker entry point (module format)
// ---------------------------------------------------------------------------

module.exports = {
  fetch: handleScanWebhook,
};

module.exports._internal = {
  parsePayload,
  extractContactInfo,
  extractScanData,
  buildHubSpotProperties,
  handleScanWebhook,
  handlePlanDownload,
  normalizePayloadKeys,
  JOTFORM_SCAN_FIELD_MAP,
  QID_TO_FIELD,
};
