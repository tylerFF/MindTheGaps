/**
 * MindtheGaps — Confidence Calculator
 *
 * Pure function that determines plan confidence level by counting "Not sure"
 * (or missing) answers in the Tier-1 baseline fields for the contact's
 * primary gap pillar.
 *
 * Spec reference: PROJECT_CONTEXT.md Section 5
 *
 * Confidence levels:
 *   High  — 0-1 "Not sure" answers
 *   Med   — 2-3 "Not sure" answers
 *   Low   — ≥4 "Not sure" answers
 *
 * Confidence-based plan rules:
 *   High  — Constraints section is optional
 *   Med   — Must include at least 1 constraint row (max 3)
 *   Low   — Must include constraints + a "Data gaps to measure" box
 *
 * Public API:
 *   calculateConfidence(baselineFields, primaryGap)  → ConfidenceResult
 *
 * ConfidenceResult shape:
 *   {
 *     level:              'High' | 'Med' | 'Low',
 *     notSureCount:       number,   // "Not sure" + missing fields
 *     totalFields:        number,   // total Tier-1 fields for this pillar
 *     answeredCount:      number,   // fields with non-"Not sure" values
 *     includeConstraints: boolean,  // true if Med or Low
 *     includeDataGaps:    boolean,  // true if Low only
 *   }
 */

const { BASELINE_FIELDS } = require('../../shared/constants');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: 'High',
  MED: 'Med',
  LOW: 'Low',
});

const NOT_SURE_LOWER = 'not sure';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check if a value is "Not sure" (case-insensitive, trimmed).
 */
function isNotSure(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === NOT_SURE_LOWER;
}

/**
 * Count "Not sure" or missing answers in the baseline fields for a pillar.
 * Missing / empty / null values are counted the same as "Not sure"
 * because we lack data either way.
 */
function countNotSure(baselineFields, primaryGap) {
  const fieldKeys = BASELINE_FIELDS[primaryGap] || [];
  const answers = baselineFields || {};
  let count = 0;

  for (const key of fieldKeys) {
    const value = answers[key];
    if (!value || (typeof value === 'string' && value.trim() === '') || isNotSure(value)) {
      count++;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the confidence level for a scan based on baseline field answers.
 *
 * @param {object} baselineFields — { fieldKey: answerValue } from scan worksheet
 * @param {string} primaryGap — one of PILLARS values (Acquisition, Conversion, Retention)
 * @returns {ConfidenceResult}
 */
function calculateConfidence(baselineFields, primaryGap) {
  const fieldKeys = BASELINE_FIELDS[primaryGap] || [];
  const totalFields = fieldKeys.length;
  const notSureCount = countNotSure(baselineFields, primaryGap);
  const answeredCount = totalFields - notSureCount;

  let level;
  if (notSureCount <= 1) {
    level = CONFIDENCE_LEVELS.HIGH;
  } else if (notSureCount <= 3) {
    level = CONFIDENCE_LEVELS.MED;
  } else {
    level = CONFIDENCE_LEVELS.LOW;
  }

  return {
    level,
    notSureCount,
    totalFields,
    answeredCount,
    includeConstraints: level !== CONFIDENCE_LEVELS.HIGH,
    includeDataGaps: level === CONFIDENCE_LEVELS.LOW,
  };
}

module.exports = {
  calculateConfidence,
  CONFIDENCE_LEVELS,
  _internal: { isNotSure, countNotSure },
};
