/**
 * MindtheGaps — Quiz Webhook Handler (Cloudflare Worker)
 *
 * Receives a JotForm quiz submission webhook, then:
 *   1. Parses contact info + quiz answers from the payload
 *   2. Scores the quiz (scoreQuiz)
 *   3. Generates results content (generateResults)
 *   4. Checks scan eligibility (checkEligibility)
 *   5. Writes everything to HubSpot (upsert contact by email)
 *   6. Returns results JSON for the results page to consume
 *
 * Environment bindings (set in wrangler.toml / dashboard):
 *   HUBSPOT_API_KEY — HubSpot private app token
 *
 * JotForm field mapping: update JOTFORM_FIELD_MAP below once the form is built.
 */

const { scoreQuiz } = require('./scoring');
const { generateResults } = require('./results');
const { checkEligibility } = require('./eligibility');
const { createHubSpotClient } = require('../../shared/hubspot');
const { isValidEmail, normalizeEmail, sanitizeString } = require('../../shared/validation');
const { QUESTION_IDS, HUBSPOT_PREFIX } = require('../../shared/constants');

// ---------------------------------------------------------------------------
// JotForm field mapping
//
// Maps JotForm field names → internal keys.
// Update these when the JotForm form (mtg_quiz_v2_1e) is finalized.
// ---------------------------------------------------------------------------

const JOTFORM_FIELD_MAP = {
  // Contact info fields (JotForm field name → property key)
  // Form ID: 260466844433158 (card layout)
  contact: {
    q14_quiz_firstName: 'firstName',
    q15_quiz_email: 'email',
    q16_quiz_businessName: 'businessName',
    q17_quiz_industry: 'industry',
    q18_quiz_location: 'location',
    q19_quiz_teamSize: 'teamSize',
    q20_quiz_website: 'websiteUrl',
    q21_quiz_phone: 'phone',
  },

  // Quiz answer fields (JotForm field name → question ID)
  answers: {
    q3_quiz_V1: 'V1',
    q5_quiz_V2: 'V2',
    q7_quiz_V3: 'V3',
    q9_quiz_V4: 'V4',
    q11_quiz_V5: 'V5',
    q23_quiz_A1: 'A1',
    q25_quiz_C1: 'C1',
    q27_quiz_C2: 'C2',
    q29_quiz_C3: 'C3',
    q31_quiz_C4: 'C4',
    q33_quiz_R1: 'R1',
    q35_quiz_R2: 'R2',
    q37_quiz_R3: 'R3',
  },
};

// ---------------------------------------------------------------------------
// CORS configuration
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Tighten to results page domain in production
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function corsResponse(body, status = 200) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message, status = 400) {
  return corsResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Payload parsing
// ---------------------------------------------------------------------------

/**
 * Parse the incoming webhook payload into a flat key-value map.
 *
 * JotForm can send:
 *   - Form-encoded body (application/x-www-form-urlencoded)
 *   - JSON body with rawRequest (contains stringified form data)
 *   - JSON body with answers object
 *
 * This normalizes all formats into a flat { fieldName: value } map.
 */
async function parsePayload(request) {
  const contentType = request.headers.get('Content-Type') || '';

  // Form-encoded
  if (contentType.includes('form')) {
    const formData = await request.formData();
    const flat = {};
    for (const [key, value] of formData.entries()) {
      flat[key] = value;
    }

    // JotForm sometimes nests a rawRequest field inside form data
    if (flat.rawRequest) {
      try {
        const raw = JSON.parse(flat.rawRequest);
        return { ...flat, ...raw };
      } catch {
        // rawRequest wasn't JSON — keep flat as-is
      }
    }

    return flat;
  }

  // JSON body
  if (contentType.includes('json')) {
    const json = await request.json();

    // JotForm webhook format: { rawRequest: "{...}" }
    if (json.rawRequest && typeof json.rawRequest === 'string') {
      try {
        return JSON.parse(json.rawRequest);
      } catch {
        return json;
      }
    }

    return json;
  }

  // Fallback: try to parse as text → JSON
  const text = await request.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Simple field name map (custom quiz page sends these — no JotForm prefix).
 */
const SIMPLE_CONTACT_MAP = {
  firstName: 'firstName',
  email: 'email',
  businessName: 'businessName',
  industry: 'industry',
  location: 'location',
  teamSize: 'teamSize',
  website: 'websiteUrl',
  phone: 'phone',
};

/**
 * Extract contact info from the parsed payload using the field map.
 * Tries JotForm-prefixed names first, then falls back to simple names.
 */
function extractContactInfo(payload) {
  const info = {};
  // Try JotForm field names first
  for (const [jotformField, key] of Object.entries(JOTFORM_FIELD_MAP.contact)) {
    const value = payload[jotformField];
    if (value !== undefined && value !== null && value !== '') {
      info[key] = sanitizeString(String(value));
    }
  }
  // Fallback: try simple field names (from custom quiz page)
  for (const [simpleField, key] of Object.entries(SIMPLE_CONTACT_MAP)) {
    if (!info[key]) {
      const value = payload[simpleField];
      if (value !== undefined && value !== null && value !== '') {
        info[key] = sanitizeString(String(value));
      }
    }
  }
  return info;
}

/**
 * Extract quiz answers from the parsed payload using the field map.
 * Tries JotForm-prefixed names first, then falls back to simple question IDs.
 */
function extractQuizAnswers(payload) {
  const answers = {};
  // Try JotForm field names first
  for (const [jotformField, questionId] of Object.entries(JOTFORM_FIELD_MAP.answers)) {
    const value = payload[jotformField];
    if (value !== undefined && value !== null && value !== '') {
      answers[questionId] = String(value).trim();
    }
  }
  // Fallback: try simple question IDs (V1, A1, C1, etc.)
  if (Object.keys(answers).length === 0) {
    for (const qId of QUESTION_IDS) {
      const value = payload[qId];
      if (value !== undefined && value !== null && value !== '') {
        answers[qId] = String(value).trim();
      }
    }
  }
  return answers;
}

// ---------------------------------------------------------------------------
// HubSpot property builder
// ---------------------------------------------------------------------------

/**
 * Build the full set of HubSpot contact properties from all processing results.
 */
function buildHubSpotProperties(contactInfo, answers, scoringResult, resultsContent, eligibilityResult) {
  const props = {};

  // Contact info
  if (contactInfo.firstName) props.mtg_first_name = contactInfo.firstName;
  if (contactInfo.businessName) props.mtg_business_name = contactInfo.businessName;
  if (contactInfo.industry) props.mtg_industry = contactInfo.industry;
  if (contactInfo.location) props.mtg_location = contactInfo.location;
  if (contactInfo.teamSize) {
    // Map JotForm value to HubSpot expected value
    props.mtg_team_size = contactInfo.teamSize === 'Less than 10' ? '<10' : contactInfo.teamSize;
  }
  if (contactInfo.websiteUrl) props.mtg_website_url = contactInfo.websiteUrl;
  if (contactInfo.phone) props.mtg_phone = contactInfo.phone;

  // Quiz metadata
  props.mtg_quiz_completed = 'true';
  props.mtg_quiz_completed_at = new Date().toISOString();

  // Raw quiz answers
  for (const qId of QUESTION_IDS) {
    const hsField = `${HUBSPOT_PREFIX}quiz_${qId.toLowerCase()}`;
    if (answers[qId]) {
      props[hsField] = answers[qId];
    }
  }

  // Scoring results
  props.mtg_primary_gap = scoringResult.primaryGap;
  props.mtg_quiz_score = String(scoringResult.baselineScore);

  // Results content
  if (resultsContent.subDiagnosis) {
    props.mtg_sub_diagnosis = resultsContent.subDiagnosis;
  }
  if (resultsContent.keySignals.length > 0) {
    props.mtg_key_signals = resultsContent.keySignals.join(' | ');
  }
  props.mtg_cost_of_leak = resultsContent.costOfLeak;

  // Eligibility
  props.mtg_scan_eligible = eligibilityResult.eligible ? 'true' : 'false';
  if (eligibilityResult.fixFirstReason) {
    props.mtg_fix_first_reason = eligibilityResult.fixFirstReason;
  }

  return props;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handleQuizWebhook(request, env, ctx) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Handle GET request for results lookup by submission ID
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const sid = url.searchParams.get('sid');
    if (sid && env.MTG_RESULTS_CACHE) {
      const cached = await env.MTG_RESULTS_CACHE.get(`result:${sid}`);
      if (cached) return corsResponse(JSON.parse(cached));
      return errorResponse('Result not found', 404);
    }
    return errorResponse('Missing sid parameter', 400);
  }

  // Only POST allowed for webhook
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // 1. Parse the incoming payload
    const payload = await parsePayload(request);

    // 2. Extract contact info and quiz answers
    const contactInfo = extractContactInfo(payload);
    const answers = extractQuizAnswers(payload);

    // 3. Validate email
    const rawEmail = contactInfo.email || payload.email || '';
    const email = normalizeEmail(rawEmail);

    if (!isValidEmail(email)) {
      return errorResponse('A valid email address is required');
    }

    // 4. Score the quiz
    const scoringResult = scoreQuiz(answers);

    // 5. Generate results content
    const resultsContent = generateResults(scoringResult, answers);

    // 6. Check eligibility
    const eligibilityResult = checkEligibility(scoringResult, answers);

    // 7. Build HubSpot properties
    const hubspotProps = buildHubSpotProperties(
      contactInfo, answers, scoringResult, resultsContent, eligibilityResult,
    );

    // 8. Write to HubSpot (non-blocking — don't fail the user-facing response)
    let hubspotStatus = 'skipped';
    console.log('HubSpot API key present:', !!env.HUBSPOT_API_KEY);

    if (env.HUBSPOT_API_KEY) {
      const hubspotWrite = async () => {
        console.log('HubSpot write starting');
        try {
          const client = createHubSpotClient(env.HUBSPOT_API_KEY);
          const result = await client.upsertContact(email, hubspotProps);
          hubspotStatus = result.created ? 'created' : 'updated';
          console.log('HubSpot write success:', hubspotStatus);
        } catch (err) {
          console.log('HubSpot write error:', err.message);
          console.error('HubSpot write failed:', err.message);
          hubspotStatus = 'error';
        }
      };

      // Use ctx.waitUntil so the Worker stays alive to finish the write,
      // but don't block the response to the client.
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(hubspotWrite());
      } else {
        // Fallback for testing: await directly
        await hubspotWrite();
      }
    }

    // 9. Build the results page data payload
    const resultsData = {
      scoring: {
        primaryGap: scoringResult.primaryGap,
        baselineScore: scoringResult.baselineScore,
        pillarTotals: scoringResult.pillarTotals,
      },
      results: {
        primaryGapStatement: resultsContent.primaryGapStatement,
        subDiagnosis: resultsContent.subDiagnosis,
        subDiagnosisDisplay: resultsContent.subDiagnosisDisplay,
        keySignalsLine: resultsContent.keySignalsLine,
        costOfLeak: resultsContent.costOfLeak,
        costOfLeakAdvice: resultsContent.costOfLeakAdvice,
        fastestNextSteps: resultsContent.fastestNextSteps,
      },
      eligibility: {
        eligible: eligibilityResult.eligible,
        fixFirstReason: eligibilityResult.fixFirstReason,
        fixFirstAdvice: eligibilityResult.fixFirstAdvice,
      },
    };

    // Generate results page URL with base64-encoded data in hash fragment
    const resultsPageBase = env.RESULTS_PAGE_URL || '/results/';
    const encodedData = btoa(JSON.stringify(resultsData));
    const resultsUrl = `${resultsPageBase}#${encodedData}`;
	// Store results URL in KV keyed by submission ID (expires in 1 hour)
const submissionId = payload.submissionID || payload.id || email + Date.now();
if (env.MTG_RESULTS_CACHE) {
  ctx.waitUntil(
    env.MTG_RESULTS_CACHE.put(`result:${submissionId}`, JSON.stringify({ resultsUrl }), { expirationTtl: 3600 })
  );
}
    // 10. Return results JSON for the results page
    return corsResponse({
      success: true,
      email,
      resultsUrl,
      ...resultsData,
      _meta: {
        hubspotStatus,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Quiz webhook error:', err);
    return errorResponse('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// Worker entry point (module format)
// ---------------------------------------------------------------------------

module.exports = {
  fetch: handleQuizWebhook,
};

// Also export internals for testing
module.exports._internal = {
  parsePayload,
  extractContactInfo,
  extractQuizAnswers,
  buildHubSpotProperties,
  handleQuizWebhook,
  JOTFORM_FIELD_MAP,
};
