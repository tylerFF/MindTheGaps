/**
 * MindtheGaps — Confidence Calculator Tests
 *
 * Tests for workers/mtg-scan-webhook/src/confidence.js
 * Run: node --test tests/confidence.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { calculateConfidence, CONFIDENCE_LEVELS, _internal } = require('../workers/mtg-scan-webhook/src/confidence');
const { PILLARS, BASELINE_FIELDS } = require('../workers/shared/constants');
const { buildBaselineWithNotSure, DEFAULT_CONV_BASELINE, DEFAULT_ACQ_BASELINE, DEFAULT_RET_BASELINE } = require('./scanTestCases');

// ===========================================================================
// Internal helpers
// ===========================================================================

describe('isNotSure (confidence)', () => {
  const { isNotSure } = _internal;

  it('matches "Not sure"', () => {
    assert.equal(isNotSure('Not sure'), true);
  });

  it('is case-insensitive', () => {
    assert.equal(isNotSure('NOT SURE'), true);
    assert.equal(isNotSure('not sure'), true);
  });

  it('trims whitespace', () => {
    assert.equal(isNotSure('  Not sure  '), true);
  });

  it('rejects other values', () => {
    assert.equal(isNotSure('11-25'), false);
    assert.equal(isNotSure(''), false);
    assert.equal(isNotSure(null), false);
  });
});

describe('countNotSure', () => {
  const { countNotSure } = _internal;

  it('returns 0 when all Conversion fields are answered', () => {
    assert.equal(countNotSure(DEFAULT_CONV_BASELINE, PILLARS.CONVERSION), 0);
  });

  it('counts "Not sure" answers', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 3);
    assert.equal(countNotSure(baseline, PILLARS.CONVERSION), 3);
  });

  it('counts missing fields as "Not sure"', () => {
    const baseline = { ...DEFAULT_CONV_BASELINE };
    delete baseline.conv_inbound_leads;
    delete baseline.conv_first_response_time;
    assert.equal(countNotSure(baseline, PILLARS.CONVERSION), 2);
  });

  it('counts empty strings as "Not sure"', () => {
    const baseline = { ...DEFAULT_CONV_BASELINE };
    baseline.conv_inbound_leads = '';
    baseline.conv_first_response_time = '   ';
    assert.equal(countNotSure(baseline, PILLARS.CONVERSION), 2);
  });

  it('counts all fields for empty baseline', () => {
    assert.equal(countNotSure({}, PILLARS.CONVERSION), 7);
    assert.equal(countNotSure({}, PILLARS.ACQUISITION), 7);
    assert.equal(countNotSure({}, PILLARS.RETENTION), 6);
  });

  it('returns 0 for unknown pillar (no fields to check)', () => {
    assert.equal(countNotSure(DEFAULT_CONV_BASELINE, 'Unknown'), 0);
  });

  it('handles null baseline', () => {
    assert.equal(countNotSure(null, PILLARS.CONVERSION), 7);
  });
});

// ===========================================================================
// Confidence levels — Conversion (7 fields)
// ===========================================================================

describe('calculateConfidence — Conversion pillar', () => {
  it('High confidence with 0 "Not sure" answers', () => {
    const result = calculateConfidence(DEFAULT_CONV_BASELINE, PILLARS.CONVERSION);
    assert.equal(result.level, CONFIDENCE_LEVELS.HIGH);
    assert.equal(result.notSureCount, 0);
    assert.equal(result.totalFields, 7);
    assert.equal(result.answeredCount, 7);
  });

  it('High confidence with 1 "Not sure" answer', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 1);
    const result = calculateConfidence(baseline, PILLARS.CONVERSION);
    assert.equal(result.level, CONFIDENCE_LEVELS.HIGH);
    assert.equal(result.notSureCount, 1);
    assert.equal(result.answeredCount, 6);
  });

  it('Med confidence with 2 "Not sure" answers', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 2);
    const result = calculateConfidence(baseline, PILLARS.CONVERSION);
    assert.equal(result.level, CONFIDENCE_LEVELS.MED);
    assert.equal(result.notSureCount, 2);
    assert.equal(result.answeredCount, 5);
  });

  it('Med confidence with 3 "Not sure" answers', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 3);
    const result = calculateConfidence(baseline, PILLARS.CONVERSION);
    assert.equal(result.level, CONFIDENCE_LEVELS.MED);
    assert.equal(result.notSureCount, 3);
    assert.equal(result.answeredCount, 4);
  });

  it('Low confidence with 4 "Not sure" answers', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 4);
    const result = calculateConfidence(baseline, PILLARS.CONVERSION);
    assert.equal(result.level, CONFIDENCE_LEVELS.LOW);
    assert.equal(result.notSureCount, 4);
    assert.equal(result.answeredCount, 3);
  });

  it('Low confidence with all 7 "Not sure" answers', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 7);
    const result = calculateConfidence(baseline, PILLARS.CONVERSION);
    assert.equal(result.level, CONFIDENCE_LEVELS.LOW);
    assert.equal(result.notSureCount, 7);
    assert.equal(result.answeredCount, 0);
  });
});

// ===========================================================================
// Confidence levels — Acquisition (7 fields)
// ===========================================================================

describe('calculateConfidence — Acquisition pillar', () => {
  it('High confidence with all fields answered', () => {
    const result = calculateConfidence(DEFAULT_ACQ_BASELINE, PILLARS.ACQUISITION);
    assert.equal(result.level, CONFIDENCE_LEVELS.HIGH);
    assert.equal(result.totalFields, 7);
  });

  it('Med confidence with 2 "Not sure"', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.ACQUISITION, 2);
    const result = calculateConfidence(baseline, PILLARS.ACQUISITION);
    assert.equal(result.level, CONFIDENCE_LEVELS.MED);
    assert.equal(result.notSureCount, 2);
  });

  it('Low confidence with 4 "Not sure"', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.ACQUISITION, 4);
    const result = calculateConfidence(baseline, PILLARS.ACQUISITION);
    assert.equal(result.level, CONFIDENCE_LEVELS.LOW);
    assert.equal(result.notSureCount, 4);
  });
});

// ===========================================================================
// Confidence levels — Retention (6 fields)
// ===========================================================================

describe('calculateConfidence — Retention pillar', () => {
  it('High confidence with all 6 fields answered', () => {
    const result = calculateConfidence(DEFAULT_RET_BASELINE, PILLARS.RETENTION);
    assert.equal(result.level, CONFIDENCE_LEVELS.HIGH);
    assert.equal(result.totalFields, 6);
    assert.equal(result.notSureCount, 0);
  });

  it('High confidence with 1 "Not sure" (of 6)', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.RETENTION, 1);
    const result = calculateConfidence(baseline, PILLARS.RETENTION);
    assert.equal(result.level, CONFIDENCE_LEVELS.HIGH);
    assert.equal(result.answeredCount, 5);
  });

  it('Med confidence with 2 "Not sure" (of 6)', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.RETENTION, 2);
    const result = calculateConfidence(baseline, PILLARS.RETENTION);
    assert.equal(result.level, CONFIDENCE_LEVELS.MED);
  });

  it('Med confidence with 3 "Not sure" (of 6)', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.RETENTION, 3);
    const result = calculateConfidence(baseline, PILLARS.RETENTION);
    assert.equal(result.level, CONFIDENCE_LEVELS.MED);
  });

  it('Low confidence with 4 "Not sure" (of 6)', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.RETENTION, 4);
    const result = calculateConfidence(baseline, PILLARS.RETENTION);
    assert.equal(result.level, CONFIDENCE_LEVELS.LOW);
  });

  it('Low confidence with all 6 "Not sure"', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.RETENTION, 6);
    const result = calculateConfidence(baseline, PILLARS.RETENTION);
    assert.equal(result.level, CONFIDENCE_LEVELS.LOW);
    assert.equal(result.notSureCount, 6);
    assert.equal(result.answeredCount, 0);
  });
});

// ===========================================================================
// Plan rule flags
// ===========================================================================

describe('calculateConfidence — plan rule flags', () => {
  it('High: includeConstraints = false, includeDataGaps = false', () => {
    const result = calculateConfidence(DEFAULT_CONV_BASELINE, PILLARS.CONVERSION);
    assert.equal(result.includeConstraints, false);
    assert.equal(result.includeDataGaps, false);
  });

  it('Med: includeConstraints = true, includeDataGaps = false', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 2);
    const result = calculateConfidence(baseline, PILLARS.CONVERSION);
    assert.equal(result.includeConstraints, true);
    assert.equal(result.includeDataGaps, false);
  });

  it('Low: includeConstraints = true, includeDataGaps = true', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 4);
    const result = calculateConfidence(baseline, PILLARS.CONVERSION);
    assert.equal(result.includeConstraints, true);
    assert.equal(result.includeDataGaps, true);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('calculateConfidence — edge cases', () => {
  it('handles null baselineFields', () => {
    const result = calculateConfidence(null, PILLARS.CONVERSION);
    assert.equal(result.level, CONFIDENCE_LEVELS.LOW);
    assert.equal(result.notSureCount, 7);
  });

  it('handles undefined baselineFields', () => {
    const result = calculateConfidence(undefined, PILLARS.CONVERSION);
    assert.equal(result.level, CONFIDENCE_LEVELS.LOW);
    assert.equal(result.notSureCount, 7);
  });

  it('handles empty baselineFields object', () => {
    const result = calculateConfidence({}, PILLARS.CONVERSION);
    assert.equal(result.level, CONFIDENCE_LEVELS.LOW);
    assert.equal(result.notSureCount, 7);
    assert.equal(result.answeredCount, 0);
  });

  it('handles unknown pillar gracefully (0 fields)', () => {
    const result = calculateConfidence(DEFAULT_CONV_BASELINE, 'Unknown');
    assert.equal(result.level, CONFIDENCE_LEVELS.HIGH);
    assert.equal(result.totalFields, 0);
    assert.equal(result.notSureCount, 0);
  });

  it('handles null pillar', () => {
    const result = calculateConfidence(DEFAULT_CONV_BASELINE, null);
    assert.equal(result.level, CONFIDENCE_LEVELS.HIGH);
    assert.equal(result.totalFields, 0);
  });

  it('mixed "Not sure" and missing fields combined count', () => {
    const baseline = { ...DEFAULT_CONV_BASELINE };
    baseline.conv_inbound_leads = 'Not sure';        // explicit "Not sure"
    delete baseline.conv_first_response_time;          // missing
    baseline.conv_lead_to_booked = '';                 // empty string
    const result = calculateConfidence(baseline, PILLARS.CONVERSION);
    assert.equal(result.notSureCount, 3);  // 1 "Not sure" + 1 missing + 1 empty
    assert.equal(result.level, CONFIDENCE_LEVELS.MED);
  });

  it('CONFIDENCE_LEVELS enum is frozen', () => {
    assert.equal(Object.isFrozen(CONFIDENCE_LEVELS), true);
  });
});
