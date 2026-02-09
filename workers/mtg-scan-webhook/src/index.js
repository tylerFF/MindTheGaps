/**
 * MindtheGaps — Scan Webhook Handler (Cloudflare Worker)
 *
 * Receives a JotForm scan worksheet submission, then:
 *   1. Parses contact info + scan data from the payload
 *   2. Validates email
 *   3. Runs stop rules — if stopped, notify Marc + write HubSpot + return
 *   4. Calculates confidence
 *   5. Generates plan via Claude API
 *   6. Builds DOCX
 *   7. Uploads to R2
 *   8. Writes everything to HubSpot
 *   9. Notifies Marc
 *
 * Environment bindings (set in wrangler.toml / dashboard):
 *   HUBSPOT_API_KEY, CLAUDE_API_KEY, RESEND_API_KEY,
 *   R2_BUCKET, MARC_EMAIL, FROM_EMAIL, CLAUDE_MODEL
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
  contact: {
    s_email: 'email',
    s_first_name: 'firstName',
    s_business_name: 'businessName',
    s_industry: 'industry',
    s_phone: 'phone',
  },
  scan: {
    s_primary_gap: 'primaryGap',
    s_quiz_primary_gap: 'quizPrimaryGap',
    s_gap_change_reason: 'gapChangeReason',
    s_sub_path: 'subPath',
    s_one_lever: 'oneLever',
  },
  // Baseline fields mapped per pillar — s_<field_key>
  baseline: Object.fromEntries(
    Object.values(BASELINE_FIELDS)
      .flat()
      .map((key) => [`s_${key}`, key]),
  ),
  // Actions: s_action_1_desc, s_action_1_owner, s_action_1_due (×6)
  // Metrics: s_metric_1, s_metric_2, s_metric_3, s_metric_4
  // Constraints: s_constraint_1, s_constraint_2, s_constraint_3
};

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

  if (contentType.includes('form')) {
    const formData = await request.formData();
    const flat = {};
    for (const [key, value] of formData.entries()) {
      flat[key] = value;
    }
    if (flat.rawRequest) {
      try {
        const raw = JSON.parse(flat.rawRequest);
        return { ...flat, ...raw };
      } catch { /* keep flat */ }
    }
    return flat;
  }

  if (contentType.includes('json')) {
    const json = await request.json();
    if (json.rawRequest && typeof json.rawRequest === 'string') {
      try { return JSON.parse(json.rawRequest); } catch { return json; }
    }
    return json;
  }

  const text = await request.text();
  try { return JSON.parse(text); } catch { return {}; }
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
  scan.subPath = scan.subPath || '';
  scan.oneLever = scan.oneLever || '';

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
    scan.actions.push({
      description: String(payload[`s_action_${i}_desc`] || '').trim(),
      owner: String(payload[`s_action_${i}_owner`] || '').trim(),
      dueDate: String(payload[`s_action_${i}_due`] || '').trim(),
    });
  }

  // Metrics (up to 4)
  scan.metrics = [];
  for (let i = 1; i <= 4; i++) {
    const value = payload[`s_metric_${i}`];
    if (value && String(value).trim()) {
      scan.metrics.push(String(value).trim());
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
  props.mtg_primary_gap_confirmed = scanData.primaryGap;
  props.mtg_sub_path = scanData.subPath;
  props.mtg_one_lever = scanData.oneLever;

  if (stopResult && stopResult.stopped) {
    props.mtg_scan_stop_reason = stopResult.reasons.join(' | ');
    props.mtg_plan_review_status = 'Manual Required';
    return props;
  }

  // Confidence
  if (confidenceResult) {
    props.mtg_confidence_level = confidenceResult.level;
    props.mtg_confidence_not_sure_count = String(confidenceResult.notSureCount);
  }

  // Plan
  if (planUrl) {
    props.mtg_plan_url = planUrl;
    props.mtg_plan_review_status = 'Pending Review';
  }

  return props;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handleScanWebhook(request, env, ctx) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only POST
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

    // 6. Generate plan (needs CLAUDE_API_KEY)
    let planContent = null;
    if (env.CLAUDE_API_KEY) {
      planContent = await generatePlan(scanData, contactInfo, confidenceResult, env);
    }

    // 7. Build DOCX (skip if no planContent)
    let docxBuffer = null;
    if (planContent) {
      docxBuffer = await buildDocx(planContent, scanData, contactInfo, confidenceResult);
    }

    // 8. Upload to R2 (skip if no buffer or no bucket)
    let planUrl = null;
    if (docxBuffer && env.R2_BUCKET) {
      const key = await uploadPlan(env, email, docxBuffer);
      planUrl = `${env.R2_PUBLIC_URL || '/r2'}/${key}`;
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
  JOTFORM_SCAN_FIELD_MAP,
};
