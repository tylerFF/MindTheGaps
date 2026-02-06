/**
 * MindtheGaps — Stop Rules Engine
 *
 * Pure function that checks scan worksheet data against stop conditions.
 * Plan generation is HALTED (and Marc notified) if ANY stop rule fires.
 *
 * Spec reference: PROJECT_CONTEXT.md Section 4 / CLAUDE.md Stop Rules
 *
 * Stop rules:
 *   1. Sub-path = "not sure" or starts with "Other" (manual plan required)
 *   2. Primary gap changed from quiz without an explanation provided
 *   3. Missing required fields:
 *      - primary gap present
 *      - sub-path present (and not "not sure" / "Other")
 *      - one lever present
 *      - ≥5 non-"Not sure" Tier-1 baseline field answers
 *      - all 6 action slots filled
 *      - ≥2 metrics selected
 *
 * Public API:
 *   checkStopRules(scanData)  → StopRulesResult
 *
 * StopRulesResult shape:
 *   {
 *     stopped:  boolean,
 *     reasons:  string[],     // human-readable stop reason(s)
 *     details:  object[],     // machine-readable details per fired rule
 *   }
 *
 * scanData expected shape:
 *   {
 *     primaryGap:       string,   // confirmed gap from scan worksheet
 *     quizPrimaryGap:   string,   // original gap from quiz scoring
 *     gapChangeReason:  string,   // reason if gap was changed (optional)
 *     subPath:          string,   // selected sub-path
 *     oneLever:         string,   // selected lever
 *     baselineFields:   object,   // { fieldKey: answerValue } for Tier-1 baseline
 *     actions:          array,    // 6 action slots (strings or { description })
 *     metrics:          array,    // selected metric names (strings)
 *   }
 */

const {
  BASELINE_FIELDS,
  REQUIRED_ACTION_COUNT,
  REQUIRED_BASELINE_ANSWERS,
  REQUIRED_METRICS_COUNT,
} = require('../../shared/constants');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const NOT_SURE_LOWER = 'not sure';
const OTHER_LOWER = 'other';

/**
 * Check if a value is "Not sure" (case-insensitive, trimmed).
 */
function isNotSure(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === NOT_SURE_LOWER;
}

/**
 * Check if a value starts with "Other" (catches "Other (manual)",
 * "Other (forces manual plan)", etc.).
 */
function isOtherManual(value) {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith(OTHER_LOWER);
}

/**
 * Count non-"Not sure", non-empty baseline answers for a given pillar.
 */
function countNonNotSureBaseline(baselineFields, primaryGap) {
  const fieldKeys = BASELINE_FIELDS[primaryGap] || [];
  let count = 0;
  for (const key of fieldKeys) {
    const value = baselineFields[key];
    if (value && typeof value === 'string' && value.trim() !== '' && !isNotSure(value)) {
      count++;
    }
  }
  return count;
}

/**
 * Count filled action slots. Accepts strings or objects with a description.
 */
function countFilledActions(actions) {
  if (!Array.isArray(actions)) return 0;
  let count = 0;
  for (const action of actions) {
    if (!action) continue;
    if (typeof action === 'string' && action.trim() !== '') {
      count++;
    } else if (typeof action === 'object' && action.description && action.description.trim() !== '') {
      count++;
    }
  }
  return count;
}

/**
 * Count filled metrics (non-empty strings).
 */
function countFilledMetrics(metrics) {
  if (!Array.isArray(metrics)) return 0;
  return metrics.filter(m => m && typeof m === 'string' && m.trim() !== '').length;
}

// ---------------------------------------------------------------------------
// Individual rule checks
// ---------------------------------------------------------------------------

/**
 * Rule 1: Sub-path = "not sure" or "Other (manual)"
 */
function checkSubPath(scanData) {
  const { subPath } = scanData;

  if (!subPath || isNotSure(subPath)) {
    return {
      rule: 'subpath_not_sure',
      message: 'Sub-path is "Not sure" — requires manual plan',
    };
  }

  if (isOtherManual(subPath)) {
    return {
      rule: 'subpath_other',
      message: 'Sub-path is "Other (manual)" — requires manual plan',
    };
  }

  return null;
}

/**
 * Rule 2: Primary gap changed from quiz without explanation
 */
function checkGapChanged(scanData) {
  const { primaryGap, quizPrimaryGap, gapChangeReason } = scanData;

  // Can't compare if either is missing
  if (!primaryGap || !quizPrimaryGap) return null;

  if (primaryGap !== quizPrimaryGap) {
    const reason = gapChangeReason && typeof gapChangeReason === 'string'
      ? gapChangeReason.trim()
      : '';
    if (reason === '') {
      return {
        rule: 'gap_changed_no_reason',
        message: `Primary gap changed from "${quizPrimaryGap}" to "${primaryGap}" without explanation`,
      };
    }
  }

  return null;
}

/**
 * Rule 3: Missing required fields
 */
function checkMissingFields(scanData) {
  const missing = [];

  // Primary gap
  if (!scanData.primaryGap) {
    missing.push('primary gap');
  }

  // Sub-path (presence only — "not sure"/"other" caught by Rule 1)
  if (!scanData.subPath) {
    missing.push('sub-path');
  }

  // One lever
  if (!scanData.oneLever || (typeof scanData.oneLever === 'string' && scanData.oneLever.trim() === '')) {
    missing.push('one lever');
  }

  // Baseline: ≥5 non-"Not sure" answers
  const baselineFields = scanData.baselineFields || {};
  const nonNotSureCount = countNonNotSureBaseline(baselineFields, scanData.primaryGap);
  if (nonNotSureCount < REQUIRED_BASELINE_ANSWERS) {
    missing.push(`baseline data (${nonNotSureCount}/${REQUIRED_BASELINE_ANSWERS} non-"Not sure" answers)`);
  }

  // All 6 action slots
  const filledActions = countFilledActions(scanData.actions);
  if (filledActions < REQUIRED_ACTION_COUNT) {
    missing.push(`action slots (${filledActions}/${REQUIRED_ACTION_COUNT} filled)`);
  }

  // ≥2 metrics
  const filledMetrics = countFilledMetrics(scanData.metrics);
  if (filledMetrics < REQUIRED_METRICS_COUNT) {
    missing.push(`metrics (${filledMetrics}/${REQUIRED_METRICS_COUNT} selected)`);
  }

  if (missing.length > 0) {
    return {
      rule: 'missing_fields',
      message: `Missing required fields: ${missing.join(', ')}`,
      missing,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check all stop rules against the provided scan data.
 *
 * @param {object} scanData — processed scan worksheet data
 * @returns {StopRulesResult}
 */
function checkStopRules(scanData) {
  if (!scanData || typeof scanData !== 'object') {
    return {
      stopped: true,
      reasons: ['No scan data provided'],
      details: [{ rule: 'no_data', message: 'No scan data provided' }],
    };
  }

  const details = [];

  const subPathResult = checkSubPath(scanData);
  if (subPathResult) details.push(subPathResult);

  const gapResult = checkGapChanged(scanData);
  if (gapResult) details.push(gapResult);

  const missingResult = checkMissingFields(scanData);
  if (missingResult) details.push(missingResult);

  return {
    stopped: details.length > 0,
    reasons: details.map(d => d.message),
    details,
  };
}

module.exports = {
  checkStopRules,
  _internal: {
    isNotSure,
    isOtherManual,
    countNonNotSureBaseline,
    countFilledActions,
    countFilledMetrics,
    checkSubPath,
    checkGapChanged,
    checkMissingFields,
  },
};
