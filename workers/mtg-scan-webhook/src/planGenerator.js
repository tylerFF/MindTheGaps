/**
 * MindtheGaps — Plan Generator
 *
 * Builds the Claude API prompt from scan data, calls the API, and parses
 * the response into the planContent shape consumed by docxBuilder.
 *
 * The prompt construction is 100% pure logic (no credentials).
 * The API call requires CLAUDE_API_KEY in env — skipped when missing.
 *
 * Spec reference: PROJECT_CONTEXT.md Section 5 (Plan Generation Rules)
 *
 * Public API:
 *   generatePlan(scanData, contactInfo, confidenceResult, env) → planContent
 *
 * Internal (exported via _internal for testing):
 *   buildSystemPrompt()
 *   buildUserPrompt(scanData, contactInfo, confidenceResult)
 *   parseResponse(text)
 *   buildSectionBData(scanData)
 */

const { BASELINE_FIELDS } = require('../../shared/constants');
const { BASELINE_LABELS } = require('./docxBuilder');

// ---------------------------------------------------------------------------
// Section B data builder — filters baseline fields to exclude "Not sure"
// ---------------------------------------------------------------------------

/**
 * Build the baseline metrics array for Section B of the plan.
 * Filters out "Not sure" and missing values, maps keys to human labels.
 *
 * @param {object} scanData — full scan data with baselineFields + primaryGap
 * @returns {Array<{ field: string, value: string }>}
 */
function buildSectionBData(scanData) {
  const gap = scanData.primaryGap;
  const fieldKeys = BASELINE_FIELDS[gap] || [];
  const baseline = scanData.baselineFields || {};
  const metrics = [];

  for (const key of fieldKeys) {
    const value = baseline[key];
    if (
      value &&
      typeof value === 'string' &&
      value.trim() !== '' &&
      value.trim().toLowerCase() !== 'not sure'
    ) {
      metrics.push({
        field: BASELINE_LABELS[key] || key,
        value: value.trim(),
      });
    }
  }

  return metrics;
}

// ---------------------------------------------------------------------------
// System prompt — JSON schema contract + content rules
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return `You are a business growth plan generator for MindtheGaps, a consulting service for small-to-medium local service businesses.

Your job is to take structured scan data from a facilitated session and produce a One-Page Growth Plan as a JSON object.

## Output Format
Return ONLY a valid JSON object with this exact structure (no markdown fencing, no explanation):

{
  "sectionA": {
    "primaryGap": "string — the confirmed primary growth gap (Acquisition, Conversion, or Retention)",
    "subDiagnosis": "string — the specific sub-path root cause",
    "supportingSignal": "string — the tie-breaker metric or evidence that confirms this diagnosis",
    "quizKeySignals": "string — optional summary of quiz signals that led to this gap"
  },
  "sectionB": {
    "baselineMetrics": [
      { "field": "string — human-readable metric name", "value": "string — current value (range)" }
    ]
  },
  "sectionC": {
    "leverName": "string — the one lever to focus on",
    "leverDescription": "string — one-sentence description of what this lever fixes (≤160 chars)",
    "whatDoneLooksLike": {
      "metric": "string — the primary metric that shows success",
      "target": "string — realistic 30-day target value"
    }
  },
  "sectionD": {
    "actions": [
      { "description": "string — specific action step", "owner": "string — who does it", "dueDate": "string — timeline (Week 1, Week 2, etc.)" }
    ]
  },
  "sectionE": {
    "metrics": [
      { "name": "string — metric name", "baseline": "string — current value", "target30Day": "string — 30-day target" }
    ]
  },
  "sectionF": {
    "constraints": ["string — risk or constraint (max 3)"],
    "dataGaps": ["string — data gaps to measure (only if low confidence)"]
  }
}

## Content Rules
- Plain language only. No jargon.
- Use ranges, not exact numbers (match input style).
- Actions must be doable without client homework that blocks the ≤24h plan SLA.
- No upsell language. No selling additional services.
- Section D must have exactly 6 actions.
- Section E should have 2-4 metrics with realistic baselines and 30-day targets.
- Section F constraints: max 3 items. Only include if confidence is Medium or Low.
- Section F data gaps: only include if confidence is Low.
- Keep descriptions concise — this is a one-page plan, not a report.`;
}

// ---------------------------------------------------------------------------
// User prompt — structured extraction of all scan data
// ---------------------------------------------------------------------------

function buildUserPrompt(scanData, contactInfo, confidenceResult) {
  const businessName = (contactInfo && contactInfo.businessName) || 'the business';
  const industry = (contactInfo && contactInfo.industry) || 'local service business';

  const baselineMetrics = buildSectionBData(scanData);
  const baselineText = baselineMetrics.length > 0
    ? baselineMetrics.map((m) => `  - ${m.field}: ${m.value}`).join('\n')
    : '  (No baseline data available)';

  const actionsText = (scanData.actions || [])
    .map((a, i) => `  ${i + 1}. ${a.description || '(empty)'} — Owner: ${a.owner || 'TBD'}, Due: ${a.dueDate || 'TBD'}`)
    .join('\n');

  const metricsText = (scanData.metrics || [])
    .map((m) => `  - ${m}`)
    .join('\n');

  const confidenceLevel = confidenceResult ? confidenceResult.level : 'Unknown';
  const includeConstraints = confidenceResult ? confidenceResult.includeConstraints : false;
  const includeDataGaps = confidenceResult ? confidenceResult.includeDataGaps : false;

  return `Generate a One-Page Growth Plan for the following business:

## Business Profile
- Business: ${businessName}
- Industry: ${industry}

## Diagnosis
- Primary Growth Gap: ${scanData.primaryGap}
- Sub-path (Root Cause): ${scanData.subPath}
- One Lever: ${scanData.oneLever}

## Current Baseline Metrics (non-"Not sure" answers only)
${baselineText}

## Facilitator-Defined Actions (6 required)
${actionsText}

## Weekly Scorecard Metrics (selected by facilitator)
${metricsText}

## Confidence Level: ${confidenceLevel}
${includeConstraints ? '- REQUIRED: Include at least 1 constraint in Section F (max 3).' : '- Constraints are optional.'}
${includeDataGaps ? '- REQUIRED: Include data gaps to measure in Section F.' : ''}

## Instructions
1. Section A: Use the diagnosis above. The primaryGap is "${scanData.primaryGap}" and the subDiagnosis is "${scanData.subPath}".
2. Section B: Use the baseline metrics provided above exactly as shown (do not invent new ones).
3. Section C: The lever is "${scanData.oneLever}". Write a ≤160-char description. Pick the most relevant scorecard metric for "what done looks like" with a realistic 30-day target.
4. Section D: Use the facilitator's 6 actions above. Clean up language if needed but preserve meaning, owners, and timelines.
5. Section E: Use the selected scorecard metrics. Add current baselines from the data above and realistic 30-day targets.
6. Section F: ${includeConstraints ? 'Include constraints.' : 'Optional.'} ${includeDataGaps ? 'Include data gaps to measure.' : 'Omit data gaps.'}

Return ONLY the JSON object. No explanation, no markdown fencing.`;
}

// ---------------------------------------------------------------------------
// Response parser — handles raw JSON, fenced JSON, and validation
// ---------------------------------------------------------------------------

const REQUIRED_SECTIONS = ['sectionA', 'sectionB', 'sectionC', 'sectionD', 'sectionE', 'sectionF'];

function parseResponse(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or invalid response from Claude API');
  }

  let cleaned = text.trim();

  // Strip markdown JSON fencing if present
  const fencedMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fencedMatch) {
    cleaned = fencedMatch[1].trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Claude API response as JSON: ${err.message}`);
  }

  // Validate all 6 sections are present
  const missing = REQUIRED_SECTIONS.filter((s) => !parsed[s]);
  if (missing.length > 0) {
    throw new Error(`Claude API response missing required sections: ${missing.join(', ')}`);
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Public API — full pipeline
// ---------------------------------------------------------------------------

/**
 * Generate a plan by calling Claude API with structured scan data.
 *
 * @param {object} scanData — full scan data from worksheet
 * @param {object} contactInfo — { businessName, email, ... }
 * @param {object} confidenceResult — from calculateConfidence()
 * @param {object} env — Worker env bindings (needs CLAUDE_API_KEY)
 * @returns {Promise<object>} planContent — structured JSON for docxBuilder
 */
async function generatePlan(scanData, contactInfo, confidenceResult, env) {
  if (!env || !env.CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY is required for plan generation');
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(scanData, contactInfo, confidenceResult);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  // Extract text content from the response
  const textBlock = (result.content || []).find((b) => b.type === 'text');
  if (!textBlock || !textBlock.text) {
    throw new Error('Claude API returned no text content');
  }

  return parseResponse(textBlock.text);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  generatePlan,
  _internal: {
    buildSystemPrompt,
    buildUserPrompt,
    parseResponse,
    buildSectionBData,
    REQUIRED_SECTIONS,
  },
};
