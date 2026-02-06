/**
 * MindtheGaps — Stop Rules Engine Tests
 *
 * Tests for workers/mtg-scan-webhook/src/stopRules.js
 * Run: node --test tests/stopRules.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { checkStopRules, _internal } = require('../workers/mtg-scan-webhook/src/stopRules');
const { PILLARS, BASELINE_FIELDS, REQUIRED_ACTION_COUNT, REQUIRED_BASELINE_ANSWERS, REQUIRED_METRICS_COUNT } = require('../workers/shared/constants');
const { buildScanData, buildBaselineWithNotSure, DEFAULT_ACTIONS, DEFAULT_METRICS } = require('./scanTestCases');

// ===========================================================================
// Helper: internal functions
// ===========================================================================

describe('isNotSure', () => {
  const { isNotSure } = _internal;

  it('matches "Not sure" exactly', () => {
    assert.equal(isNotSure('Not sure'), true);
  });

  it('matches case-insensitively', () => {
    assert.equal(isNotSure('not sure'), true);
    assert.equal(isNotSure('NOT SURE'), true);
    assert.equal(isNotSure('Not Sure'), true);
  });

  it('trims whitespace', () => {
    assert.equal(isNotSure('  Not sure  '), true);
  });

  it('rejects other strings', () => {
    assert.equal(isNotSure('Yes'), false);
    assert.equal(isNotSure(''), false);
    assert.equal(isNotSure('Not'), false);
  });

  it('rejects non-strings', () => {
    assert.equal(isNotSure(null), false);
    assert.equal(isNotSure(undefined), false);
    assert.equal(isNotSure(42), false);
  });
});

describe('isOtherManual', () => {
  const { isOtherManual } = _internal;

  it('matches "Other (manual)"', () => {
    assert.equal(isOtherManual('Other (manual)'), true);
  });

  it('matches "Other (forces manual plan)"', () => {
    assert.equal(isOtherManual('Other (forces manual plan)'), true);
  });

  it('matches case-insensitively', () => {
    assert.equal(isOtherManual('other (manual)'), true);
    assert.equal(isOtherManual('OTHER (MANUAL)'), true);
  });

  it('matches any "Other..." variant', () => {
    assert.equal(isOtherManual('Other'), true);
    assert.equal(isOtherManual('Other reason here'), true);
  });

  it('rejects non-"Other" strings', () => {
    assert.equal(isOtherManual('Speed-to-lead'), false);
    assert.equal(isOtherManual(''), false);
    assert.equal(isOtherManual('Another option'), false);
  });

  it('rejects non-strings', () => {
    assert.equal(isOtherManual(null), false);
    assert.equal(isOtherManual(undefined), false);
  });
});

// ===========================================================================
// Helper: baseline counting
// ===========================================================================

describe('countNonNotSureBaseline', () => {
  const { countNonNotSureBaseline } = _internal;

  it('counts all fields when none are "Not sure"', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 0);
    assert.equal(countNonNotSureBaseline(baseline, PILLARS.CONVERSION), 7);
  });

  it('excludes "Not sure" fields', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 3);
    assert.equal(countNonNotSureBaseline(baseline, PILLARS.CONVERSION), 4);
  });

  it('excludes missing/empty fields', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.CONVERSION, 0);
    delete baseline.conv_inbound_leads;
    baseline.conv_first_response_time = '';
    assert.equal(countNonNotSureBaseline(baseline, PILLARS.CONVERSION), 5);
  });

  it('handles Acquisition pillar (7 fields)', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.ACQUISITION, 2);
    assert.equal(countNonNotSureBaseline(baseline, PILLARS.ACQUISITION), 5);
  });

  it('handles Retention pillar (6 fields)', () => {
    const baseline = buildBaselineWithNotSure(PILLARS.RETENTION, 0);
    assert.equal(countNonNotSureBaseline(baseline, PILLARS.RETENTION), 6);
  });

  it('returns 0 for empty baseline', () => {
    assert.equal(countNonNotSureBaseline({}, PILLARS.CONVERSION), 0);
  });

  it('returns 0 for unknown pillar', () => {
    assert.equal(countNonNotSureBaseline({ foo: 'bar' }, 'Unknown'), 0);
  });
});

describe('countFilledActions', () => {
  const { countFilledActions } = _internal;

  it('counts object-style actions with description', () => {
    assert.equal(countFilledActions(DEFAULT_ACTIONS), 6);
  });

  it('counts string-style actions', () => {
    const actions = ['Do thing 1', 'Do thing 2', 'Do thing 3', 'Do thing 4', 'Do thing 5', 'Do thing 6'];
    assert.equal(countFilledActions(actions), 6);
  });

  it('skips empty strings', () => {
    const actions = ['Do thing', '', '  ', 'Another'];
    assert.equal(countFilledActions(actions), 2);
  });

  it('skips null/undefined entries', () => {
    const actions = [null, undefined, { description: 'Valid' }];
    assert.equal(countFilledActions(actions), 1);
  });

  it('skips objects with empty description', () => {
    const actions = [{ description: '' }, { description: '  ' }, { description: 'Valid' }];
    assert.equal(countFilledActions(actions), 1);
  });

  it('returns 0 for non-array', () => {
    assert.equal(countFilledActions(null), 0);
    assert.equal(countFilledActions(undefined), 0);
    assert.equal(countFilledActions('string'), 0);
  });
});

describe('countFilledMetrics', () => {
  const { countFilledMetrics } = _internal;

  it('counts non-empty strings', () => {
    assert.equal(countFilledMetrics(DEFAULT_METRICS), 3);
  });

  it('skips empty/whitespace strings', () => {
    assert.equal(countFilledMetrics(['Metric 1', '', '  ', 'Metric 2']), 2);
  });

  it('returns 0 for non-array', () => {
    assert.equal(countFilledMetrics(null), 0);
    assert.equal(countFilledMetrics(undefined), 0);
  });
});

// ===========================================================================
// Rule 1: Sub-path checks
// ===========================================================================

describe('Rule 1: Sub-path stop rule', () => {
  const { checkSubPath } = _internal;

  it('stops when sub-path is "Not sure"', () => {
    const result = checkSubPath({ subPath: 'Not sure' });
    assert.notEqual(result, null);
    assert.equal(result.rule, 'subpath_not_sure');
  });

  it('stops when sub-path is "not sure" (case-insensitive)', () => {
    const result = checkSubPath({ subPath: 'not sure' });
    assert.notEqual(result, null);
    assert.equal(result.rule, 'subpath_not_sure');
  });

  it('stops when sub-path is missing', () => {
    const result = checkSubPath({ subPath: null });
    assert.notEqual(result, null);
    assert.equal(result.rule, 'subpath_not_sure');
  });

  it('stops when sub-path is empty string', () => {
    const result = checkSubPath({ subPath: '' });
    assert.notEqual(result, null);
    assert.equal(result.rule, 'subpath_not_sure');
  });

  it('stops when sub-path is "Other (manual)"', () => {
    const result = checkSubPath({ subPath: 'Other (manual)' });
    assert.notEqual(result, null);
    assert.equal(result.rule, 'subpath_other');
  });

  it('stops when sub-path is "Other (forces manual plan)"', () => {
    const result = checkSubPath({ subPath: 'Other (forces manual plan)' });
    assert.notEqual(result, null);
    assert.equal(result.rule, 'subpath_other');
  });

  it('passes for a valid sub-path', () => {
    const result = checkSubPath({ subPath: 'Speed-to-lead' });
    assert.equal(result, null);
  });

  it('passes for "Booking friction"', () => {
    const result = checkSubPath({ subPath: 'Booking friction' });
    assert.equal(result, null);
  });
});

// ===========================================================================
// Rule 2: Gap changed without reason
// ===========================================================================

describe('Rule 2: Gap changed stop rule', () => {
  const { checkGapChanged } = _internal;

  it('stops when gap changed without reason', () => {
    const result = checkGapChanged({
      primaryGap: PILLARS.ACQUISITION,
      quizPrimaryGap: PILLARS.CONVERSION,
      gapChangeReason: '',
    });
    assert.notEqual(result, null);
    assert.equal(result.rule, 'gap_changed_no_reason');
    assert.ok(result.message.includes('Conversion'));
    assert.ok(result.message.includes('Acquisition'));
  });

  it('stops when gap changed and reason is null', () => {
    const result = checkGapChanged({
      primaryGap: PILLARS.RETENTION,
      quizPrimaryGap: PILLARS.CONVERSION,
      gapChangeReason: null,
    });
    assert.notEqual(result, null);
    assert.equal(result.rule, 'gap_changed_no_reason');
  });

  it('stops when gap changed and reason is whitespace', () => {
    const result = checkGapChanged({
      primaryGap: PILLARS.RETENTION,
      quizPrimaryGap: PILLARS.CONVERSION,
      gapChangeReason: '   ',
    });
    assert.notEqual(result, null);
    assert.equal(result.rule, 'gap_changed_no_reason');
  });

  it('passes when gap changed WITH reason', () => {
    const result = checkGapChanged({
      primaryGap: PILLARS.ACQUISITION,
      quizPrimaryGap: PILLARS.CONVERSION,
      gapChangeReason: 'After discussion, lead gen is the real issue',
    });
    assert.equal(result, null);
  });

  it('passes when gap is the same', () => {
    const result = checkGapChanged({
      primaryGap: PILLARS.CONVERSION,
      quizPrimaryGap: PILLARS.CONVERSION,
      gapChangeReason: '',
    });
    assert.equal(result, null);
  });

  it('passes when quizPrimaryGap is missing (cannot compare)', () => {
    const result = checkGapChanged({
      primaryGap: PILLARS.CONVERSION,
      quizPrimaryGap: null,
      gapChangeReason: '',
    });
    assert.equal(result, null);
  });

  it('passes when primaryGap is missing (cannot compare)', () => {
    const result = checkGapChanged({
      primaryGap: null,
      quizPrimaryGap: PILLARS.CONVERSION,
      gapChangeReason: '',
    });
    assert.equal(result, null);
  });
});

// ===========================================================================
// Rule 3: Missing required fields
// ===========================================================================

describe('Rule 3: Missing fields stop rule', () => {
  const { checkMissingFields } = _internal;

  it('passes with all fields present', () => {
    const data = buildScanData();
    const result = checkMissingFields(data);
    assert.equal(result, null);
  });

  it('stops when primary gap missing', () => {
    const data = buildScanData({ primaryGap: '' });
    const result = checkMissingFields(data);
    assert.notEqual(result, null);
    assert.ok(result.missing.includes('primary gap'));
  });

  it('stops when sub-path missing', () => {
    const data = buildScanData({ subPath: '' });
    // checkSubPath handles "not sure"/"other", checkMissingFields handles empty
    data.subPath = '';
    const result = checkMissingFields(data);
    assert.notEqual(result, null);
    assert.ok(result.missing.includes('sub-path'));
  });

  it('stops when one lever missing', () => {
    const data = buildScanData({ oneLever: '' });
    const result = checkMissingFields(data);
    assert.notEqual(result, null);
    assert.ok(result.missing.includes('one lever'));
  });

  it('stops when one lever is whitespace', () => {
    const data = buildScanData({ oneLever: '   ' });
    const result = checkMissingFields(data);
    assert.notEqual(result, null);
    assert.ok(result.missing.includes('one lever'));
  });

  it('stops when baseline has fewer than 5 non-"Not sure" answers', () => {
    const data = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 3),
    });
    // 3 "Not sure" out of 7 → 4 non-"Not sure" → below threshold of 5
    const result = checkMissingFields(data);
    assert.notEqual(result, null);
    assert.ok(result.missing.some(m => m.includes('baseline')));
  });

  it('passes when baseline has exactly 5 non-"Not sure" answers', () => {
    const data = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 2),
    });
    // 2 "Not sure" out of 7 → 5 non-"Not sure" → exactly at threshold
    const result = checkMissingFields(data);
    assert.equal(result, null);
  });

  it('stops when fewer than 6 action slots filled', () => {
    const data = buildScanData({
      actions: DEFAULT_ACTIONS.slice(0, 4),
    });
    const result = checkMissingFields(data);
    assert.notEqual(result, null);
    assert.ok(result.missing.some(m => m.includes('action')));
  });

  it('passes when exactly 6 action slots filled', () => {
    const data = buildScanData(); // defaults have 6
    const result = checkMissingFields(data);
    assert.equal(result, null);
  });

  it('stops when fewer than 2 metrics', () => {
    const data = buildScanData({ metrics: ['One metric'] });
    const result = checkMissingFields(data);
    assert.notEqual(result, null);
    assert.ok(result.missing.some(m => m.includes('metrics')));
  });

  it('passes when exactly 2 metrics', () => {
    const data = buildScanData({ metrics: ['Metric 1', 'Metric 2'] });
    const result = checkMissingFields(data);
    assert.equal(result, null);
  });

  it('stops when no actions array', () => {
    const data = buildScanData();
    data.actions = undefined;
    const result = checkMissingFields(data);
    assert.notEqual(result, null);
    assert.ok(result.missing.some(m => m.includes('action')));
  });

  it('stops when no metrics array', () => {
    const data = buildScanData();
    data.metrics = undefined;
    const result = checkMissingFields(data);
    assert.notEqual(result, null);
    assert.ok(result.missing.some(m => m.includes('metrics')));
  });

  it('lists all missing items at once', () => {
    const data = buildScanData({
      primaryGap: '',
      subPath: '',
      oneLever: '',
      actions: [],
      metrics: [],
    });
    data.baselineFields = {};
    const result = checkMissingFields(data);
    assert.notEqual(result, null);
    // Should list multiple missing items
    assert.ok(result.missing.length >= 4);
  });
});

// ===========================================================================
// Integration: checkStopRules
// ===========================================================================

describe('checkStopRules — integration', () => {
  it('passes a clean scan (no stops)', () => {
    const data = buildScanData();
    const result = checkStopRules(data);
    assert.equal(result.stopped, false);
    assert.equal(result.reasons.length, 0);
    assert.equal(result.details.length, 0);
  });

  it('passes with Acquisition pillar', () => {
    const data = buildScanData({
      primaryGap: PILLARS.ACQUISITION,
      subPath: 'Channel concentration risk',
      oneLever: 'Add a secondary warm channel + weekly cadence',
    });
    const result = checkStopRules(data);
    assert.equal(result.stopped, false);
  });

  it('passes with Retention pillar', () => {
    const data = buildScanData({
      primaryGap: PILLARS.RETENTION,
      subPath: 'Rebook/recall gap',
      oneLever: 'Rebook/recall system',
    });
    const result = checkStopRules(data);
    assert.equal(result.stopped, false);
  });

  it('stops for null input', () => {
    const result = checkStopRules(null);
    assert.equal(result.stopped, true);
    assert.equal(result.details[0].rule, 'no_data');
  });

  it('stops for undefined input', () => {
    const result = checkStopRules(undefined);
    assert.equal(result.stopped, true);
  });

  it('stops for non-object input', () => {
    const result = checkStopRules('not an object');
    assert.equal(result.stopped, true);
  });

  it('stops for sub-path "Not sure"', () => {
    const data = buildScanData({ subPath: 'Not sure' });
    const result = checkStopRules(data);
    assert.equal(result.stopped, true);
    assert.ok(result.details.some(d => d.rule === 'subpath_not_sure'));
  });

  it('stops for sub-path "Other (manual)"', () => {
    const data = buildScanData({ subPath: 'Other (manual)' });
    const result = checkStopRules(data);
    assert.equal(result.stopped, true);
    assert.ok(result.details.some(d => d.rule === 'subpath_other'));
  });

  it('stops for gap change without reason', () => {
    const data = buildScanData({
      primaryGap: PILLARS.ACQUISITION,
      quizPrimaryGap: PILLARS.CONVERSION,
      subPath: 'Channel concentration risk',
      oneLever: 'Add a secondary warm channel',
    });
    const result = checkStopRules(data);
    assert.equal(result.stopped, true);
    assert.ok(result.details.some(d => d.rule === 'gap_changed_no_reason'));
  });

  it('passes for gap change WITH reason', () => {
    const data = buildScanData({
      primaryGap: PILLARS.ACQUISITION,
      quizPrimaryGap: PILLARS.CONVERSION,
      gapChangeReason: 'After review, acquisition is the real issue',
      subPath: 'Channel concentration risk',
      oneLever: 'Add a secondary warm channel',
    });
    const result = checkStopRules(data);
    assert.equal(result.stopped, false);
  });

  it('stops for insufficient baseline data', () => {
    const data = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 4),
    });
    // 4 "Not sure" out of 7 → only 3 non-"Not sure" → below 5
    const result = checkStopRules(data);
    assert.equal(result.stopped, true);
    assert.ok(result.details.some(d => d.rule === 'missing_fields'));
  });

  it('collects multiple stop reasons at once', () => {
    const data = buildScanData({
      subPath: 'Not sure',
      primaryGap: PILLARS.RETENTION,
      quizPrimaryGap: PILLARS.CONVERSION,
      gapChangeReason: '',
      oneLever: '',
      actions: [],
      metrics: [],
    });
    data.baselineFields = {};
    const result = checkStopRules(data);
    assert.equal(result.stopped, true);
    // Should have subpath_not_sure + gap_changed_no_reason + missing_fields
    assert.ok(result.details.length >= 3);
    assert.ok(result.details.some(d => d.rule === 'subpath_not_sure'));
    assert.ok(result.details.some(d => d.rule === 'gap_changed_no_reason'));
    assert.ok(result.details.some(d => d.rule === 'missing_fields'));
  });

  it('reasons array matches details length', () => {
    const data = buildScanData({ subPath: 'Not sure' });
    const result = checkStopRules(data);
    assert.equal(result.reasons.length, result.details.length);
  });

  it('each reason is a non-empty string', () => {
    const data = buildScanData({ subPath: 'Not sure' });
    const result = checkStopRules(data);
    for (const reason of result.reasons) {
      assert.equal(typeof reason, 'string');
      assert.ok(reason.length > 0);
    }
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('checkStopRules — edge cases', () => {
  it('handles empty object (everything missing)', () => {
    const result = checkStopRules({});
    assert.equal(result.stopped, true);
    // Should fire subpath + missing fields (gap change skipped since gaps are null)
    assert.ok(result.details.length >= 2);
  });

  it('Retention pillar has 6 baseline fields (not 7)', () => {
    // Retention only has 6 fields, so 2 "Not sure" leaves 4 non-"Not sure"
    // which is below the threshold of 5
    const data = buildScanData({
      primaryGap: PILLARS.RETENTION,
      subPath: 'Rebook/recall gap',
      oneLever: 'Rebook/recall system',
      baselineFields: buildBaselineWithNotSure(PILLARS.RETENTION, 2),
    });
    // 2 "Not sure" out of 6 → 4 non-"Not sure" → below 5
    const result = checkStopRules(data);
    assert.equal(result.stopped, true);
  });

  it('Retention pillar passes with 1 "Not sure" (5 non-"Not sure")', () => {
    const data = buildScanData({
      primaryGap: PILLARS.RETENTION,
      subPath: 'Rebook/recall gap',
      oneLever: 'Rebook/recall system',
      baselineFields: buildBaselineWithNotSure(PILLARS.RETENTION, 1),
    });
    // 1 "Not sure" out of 6 → 5 non-"Not sure" → at threshold
    const result = checkStopRules(data);
    assert.equal(result.stopped, false);
  });

  it('string actions work as well as object actions', () => {
    const data = buildScanData({
      actions: ['Action 1', 'Action 2', 'Action 3', 'Action 4', 'Action 5', 'Action 6'],
    });
    const result = checkStopRules(data);
    assert.equal(result.stopped, false);
  });

  it('mixed string and object actions work', () => {
    const data = buildScanData({
      actions: [
        'Action 1',
        { description: 'Action 2' },
        'Action 3',
        { description: 'Action 4' },
        'Action 5',
        { description: 'Action 6' },
      ],
    });
    const result = checkStopRules(data);
    assert.equal(result.stopped, false);
  });

  it('sub-path "Not sure" with proper case triggers stop', () => {
    const data = buildScanData({ subPath: 'Not sure' });
    const result = checkStopRules(data);
    assert.equal(result.stopped, true);
    assert.ok(result.details.some(d => d.rule === 'subpath_not_sure'));
  });
});
