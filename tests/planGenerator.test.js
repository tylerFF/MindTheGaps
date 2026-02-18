/**
 * MindtheGaps — planGenerator unit tests (deterministic version)
 *
 * Tests the deterministic plan generation: section building, baseline
 * filtering, target computation, and personalization insights.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { generatePlan, _internal } = require('../workers/mtg-scan-webhook/src/planGenerator');
const { buildScanData, buildBaselineWithNotSure, DEFAULT_ACTIONS, DEFAULT_METRICS } = require('./scanTestCases');
const { PILLARS, BASELINE_FIELDS } = require('../workers/shared/constants');
const { BASELINE_LABELS } = require('../workers/mtg-scan-webhook/src/docxBuilder');

const {
  buildSectionBData,
  buildInsights,
  getTarget,
  resolveMetricField,
  findWorstBaseline,
  countNonNotSure,
  countNotSure,
  listNotSureFields,
  RANGE_PROGRESSIONS,
  WORST_RANGES,
} = _internal;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function highConfidence() {
  return { level: 'High', notSureCount: 0, totalFields: 7, answeredCount: 7, includeConstraints: false, includeDataGaps: false };
}

function medConfidence() {
  return { level: 'Med', notSureCount: 2, totalFields: 7, answeredCount: 5, includeConstraints: true, includeDataGaps: false };
}

function lowConfidence() {
  return { level: 'Low', notSureCount: 4, totalFields: 7, answeredCount: 3, includeConstraints: true, includeDataGaps: true };
}

// ---------------------------------------------------------------------------
// getTarget
// ---------------------------------------------------------------------------

describe('planGenerator — getTarget', () => {
  it('returns next range up for worst value', () => {
    const target = getTarget('conv_first_response_time', '3+ days');
    assert.equal(target, '1-2 days');
  });

  it('returns "Maintain" for best value', () => {
    const target = getTarget('conv_first_response_time', '<1 hour');
    assert.ok(target.includes('Maintain'));
    assert.ok(target.includes('<1 hour'));
  });

  it('returns "Establish baseline" for "Not sure"', () => {
    const target = getTarget('conv_first_response_time', 'Not sure');
    assert.equal(target, 'Establish baseline');
  });

  it('returns "Improve" for unknown field key', () => {
    const target = getTarget('unknown_field', 'some value');
    assert.equal(target, 'Improve');
  });

  it('handles case-insensitive matching', () => {
    const target = getTarget('conv_first_response_time', 'SAME DAY');
    assert.equal(target, '<1 hour');
  });

  it('works for acquisition fields', () => {
    const target = getTarget('acq_top_source_dependence', '1 source');
    assert.equal(target, '2 sources');
  });

  it('works for retention fields', () => {
    const target = getTarget('ret_follow_up_time', '8+ days');
    assert.equal(target, '3-7 days');
  });
});

// ---------------------------------------------------------------------------
// resolveMetricField
// ---------------------------------------------------------------------------

describe('planGenerator — resolveMetricField', () => {
  it('resolves conversion metric directly', () => {
    assert.equal(resolveMetricField('Median response time', 'Conversion'), 'conv_first_response_time');
  });

  it('resolves shared metric with pillar override', () => {
    assert.equal(resolveMetricField('Reviews/week', 'Acquisition'), 'acq_reviews_per_month');
    assert.equal(resolveMetricField('Reviews/week', 'Retention'), 'ret_reviews_per_month');
  });

  it('returns null for unknown metric', () => {
    assert.equal(resolveMetricField('Unknown metric', 'Conversion'), null);
  });
});

// ---------------------------------------------------------------------------
// findWorstBaseline
// ---------------------------------------------------------------------------

describe('planGenerator — findWorstBaseline', () => {
  it('finds worst-range baseline field', () => {
    const scanData = buildScanData({
      baselineFields: {
        conv_inbound_leads: '11-25',
        conv_first_response_time: '3+ days',
        conv_lead_to_booked: '21-40%',
        conv_booked_to_show: '61-80%',
        conv_time_to_first_appointment: '1-3 days',
        conv_quote_sent_timeline: '48 hours',
        conv_quote_to_close: '21-30%',
      },
    });

    const worst = findWorstBaseline(scanData);
    assert.ok(worst);
    assert.equal(worst.field, 'conv_first_response_time');
    assert.equal(worst.value, '3+ days');
  });

  it('returns null when no fields are at worst range', () => {
    const scanData = buildScanData();
    const worst = findWorstBaseline(scanData);
    assert.equal(worst, null);
  });

  it('skips "Not sure" fields', () => {
    const scanData = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 7),
    });
    const worst = findWorstBaseline(scanData);
    assert.equal(worst, null);
  });
});

// ---------------------------------------------------------------------------
// countNonNotSure / countNotSure
// ---------------------------------------------------------------------------

describe('planGenerator — counting helpers', () => {
  it('countNonNotSure returns 7 for full Conversion baseline', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.CONVERSION });
    assert.equal(countNonNotSure(scanData), 7);
  });

  it('countNotSure returns 0 for full Conversion baseline', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.CONVERSION });
    assert.equal(countNotSure(scanData), 0);
  });

  it('countNotSure counts "Not sure" entries', () => {
    const scanData = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 3),
    });
    assert.equal(countNotSure(scanData), 3);
    assert.equal(countNonNotSure(scanData), 4);
  });

  it('counts missing fields as "Not sure"', () => {
    const scanData = { primaryGap: PILLARS.CONVERSION, baselineFields: {} };
    assert.equal(countNotSure(scanData), 7);
  });
});

// ---------------------------------------------------------------------------
// listNotSureFields
// ---------------------------------------------------------------------------

describe('planGenerator — listNotSureFields', () => {
  it('returns empty array when all fields answered', () => {
    const scanData = buildScanData();
    assert.equal(listNotSureFields(scanData).length, 0);
  });

  it('returns labels for "Not sure" fields', () => {
    const scanData = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 2),
    });
    const gaps = listNotSureFields(scanData);
    assert.equal(gaps.length, 2);
    assert.ok(gaps[0].includes(' '));
  });
});

// ---------------------------------------------------------------------------
// buildSectionBData
// ---------------------------------------------------------------------------

describe('planGenerator — buildSectionBData', () => {
  it('returns all fields when none are "Not sure" (Conversion)', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.CONVERSION });
    const metrics = buildSectionBData(scanData);

    assert.equal(metrics.length, 7);
    assert.ok(metrics[0].field.length > 0);
    assert.ok(metrics[0].value.length > 0);
  });

  it('filters out "Not sure" values', () => {
    const scanData = buildScanData({
      primaryGap: PILLARS.CONVERSION,
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 2),
    });
    const metrics = buildSectionBData(scanData);

    assert.equal(metrics.length, 5);
    assert.ok(metrics.every((m) => m.value.toLowerCase() !== 'not sure'));
  });

  it('uses human-readable labels', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.CONVERSION });
    const metrics = buildSectionBData(scanData);

    assert.ok(metrics[0].field.includes(' '));
  });

  it('works for Acquisition pillar', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.ACQUISITION });
    const metrics = buildSectionBData(scanData);

    assert.equal(metrics.length, 7);
  });

  it('works for Retention pillar (6 fields)', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.RETENTION });
    const metrics = buildSectionBData(scanData);

    assert.equal(metrics.length, 6);
  });

  it('returns empty array for unknown pillar', () => {
    const scanData = { primaryGap: 'FakePillar', baselineFields: {} };
    assert.equal(buildSectionBData(scanData).length, 0);
  });

  it('handles missing baselineFields', () => {
    const scanData = { primaryGap: PILLARS.CONVERSION };
    assert.equal(buildSectionBData(scanData).length, 0);
  });
});

// ---------------------------------------------------------------------------
// buildInsights (personalization)
// ---------------------------------------------------------------------------

describe('planGenerator — buildInsights', () => {
  it('generates signal-to-action when conditions met', () => {
    const scanData = buildScanData();
    const insights = buildInsights(scanData, highConfidence());

    const signalInsight = insights.find((i) => i.pattern === 'signal_to_action');
    assert.ok(signalInsight);
    assert.ok(signalInsight.text.includes('fastest win'));
    assert.equal(signalInsight.placement, 'sectionA');
  });

  it('skips signal-to-action when fewer than 4 non-"Not sure" answers', () => {
    const scanData = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 5),
    });
    const insights = buildInsights(scanData, lowConfidence());

    const signalInsight = insights.find((i) => i.pattern === 'signal_to_action');
    assert.equal(signalInsight, undefined);
  });

  it('generates risk callout when baseline at worst range', () => {
    const scanData = buildScanData({
      baselineFields: {
        conv_inbound_leads: '11-25',
        conv_first_response_time: '3+ days',
        conv_lead_to_booked: '21-40%',
        conv_booked_to_show: '61-80%',
        conv_time_to_first_appointment: '1-3 days',
        conv_quote_sent_timeline: '48 hours',
        conv_quote_to_close: '21-30%',
      },
    });
    const insights = buildInsights(scanData, highConfidence());

    const riskInsight = insights.find((i) => i.pattern === 'risk_callout');
    assert.ok(riskInsight);
    assert.ok(riskInsight.text.includes('risk to momentum'));
    assert.equal(riskInsight.placement, 'sectionF');
  });

  it('generates risk callout when >= 2 "Not sure" answers', () => {
    const scanData = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 3),
    });
    const insights = buildInsights(scanData, medConfidence());

    const riskInsight = insights.find((i) => i.pattern === 'risk_callout');
    assert.ok(riskInsight);
    assert.ok(riskInsight.text.includes('unknown'));
  });

  it('returns max 2 insights', () => {
    const scanData = buildScanData({
      baselineFields: {
        conv_inbound_leads: '11-25',
        conv_first_response_time: '3+ days',
        conv_lead_to_booked: '21-40%',
        conv_booked_to_show: '61-80%',
        conv_time_to_first_appointment: '1-3 days',
        conv_quote_sent_timeline: '48 hours',
        conv_quote_to_close: '21-30%',
      },
    });
    const insights = buildInsights(scanData, highConfidence());

    assert.ok(insights.length <= 2);
  });
});

// ---------------------------------------------------------------------------
// generatePlan (full pipeline)
// ---------------------------------------------------------------------------

describe('planGenerator — generatePlan', () => {
  it('is synchronous (returns object, not promise)', () => {
    const scanData = buildScanData();
    const result = generatePlan(scanData, {}, highConfidence());

    assert.ok(typeof result === 'object');
    assert.ok(!(result instanceof Promise));
  });

  it('returns all 6 sections + insights', () => {
    const scanData = buildScanData();
    const plan = generatePlan(scanData, {}, highConfidence());

    assert.ok(plan.sectionA);
    assert.ok(plan.sectionB);
    assert.ok(plan.sectionC);
    assert.ok(plan.sectionD);
    assert.ok(plan.sectionE);
    assert.ok(plan.sectionF);
    assert.ok(Array.isArray(plan.insights));
  });

  it('Section A contains primary gap and sub-path', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.ACQUISITION, subPath: 'Channel concentration risk' });
    const plan = generatePlan(scanData, {}, highConfidence());

    assert.equal(plan.sectionA.primaryGap, 'Acquisition');
    assert.equal(plan.sectionA.subDiagnosis, 'Channel concentration risk');
  });

  it('Section B filters "Not sure" from baseline', () => {
    const scanData = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 2),
    });
    const plan = generatePlan(scanData, {}, medConfidence());

    assert.equal(plan.sectionB.baselineMetrics.length, 5);
  });

  it('Section C uses oneLever and oneLeverSentence from scan', () => {
    const scanData = buildScanData({ oneLever: 'Response ownership + SLA + follow-up sequence' });
    scanData.oneLeverSentence = 'Fix response time to under 1 hour.';
    const plan = generatePlan(scanData, {}, highConfidence());

    assert.equal(plan.sectionC.leverName, 'Response ownership + SLA + follow-up sequence');
    assert.equal(plan.sectionC.leverDescription, 'Fix response time to under 1 hour.');
  });

  it('Section D passes through exactly 6 actions', () => {
    const scanData = buildScanData();
    const plan = generatePlan(scanData, {}, highConfidence());

    assert.equal(plan.sectionD.actions.length, 6);
    assert.equal(plan.sectionD.actions[0].description, DEFAULT_ACTIONS[0].description);
  });

  it('Section D pads to 6 when fewer actions provided', () => {
    const scanData = buildScanData({ actions: [{ description: 'Only one', owner: 'Me', dueDate: 'Now' }] });
    const plan = generatePlan(scanData, {}, highConfidence());

    assert.equal(plan.sectionD.actions.length, 6);
    assert.equal(plan.sectionD.actions[0].description, 'Only one');
    assert.equal(plan.sectionD.actions[1].description, '');
  });

  it('Section E maps metrics with baselines and targets', () => {
    const scanData = buildScanData({
      metrics: ['Median response time', 'Lead to booked %'],
    });
    const plan = generatePlan(scanData, {}, highConfidence());

    assert.equal(plan.sectionE.metrics.length, 2);
    assert.equal(plan.sectionE.metrics[0].name, 'Median response time');
    assert.ok(plan.sectionE.metrics[0].baseline);
    assert.ok(plan.sectionE.metrics[0].target30Day);
  });

  it('Section F includes constraints from scan data', () => {
    const scanData = buildScanData();
    scanData.constraints = ['Budget limited', 'No tech team'];
    const plan = generatePlan(scanData, {}, medConfidence());

    assert.deepEqual(plan.sectionF.constraints, ['Budget limited', 'No tech team']);
  });

  it('Section F includes data gaps for Low confidence', () => {
    const scanData = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 4),
    });
    const plan = generatePlan(scanData, {}, lowConfidence());

    assert.ok(plan.sectionF.dataGaps.length > 0);
    assert.ok(plan.sectionF.dataGaps[0].startsWith('Track:'));
  });

  it('Section F omits data gaps for High confidence', () => {
    const scanData = buildScanData();
    const plan = generatePlan(scanData, {}, highConfidence());

    assert.equal(plan.sectionF.dataGaps.length, 0);
  });

  it('works for all three pillars', () => {
    for (const pillar of [PILLARS.CONVERSION, PILLARS.ACQUISITION, PILLARS.RETENTION]) {
      const scanData = buildScanData({ primaryGap: pillar });
      const plan = generatePlan(scanData, {}, highConfidence());

      assert.equal(plan.sectionA.primaryGap, pillar);
      assert.ok(plan.sectionB.baselineMetrics.length > 0);
    }
  });
});

// ---------------------------------------------------------------------------
// RANGE_PROGRESSIONS coverage
// ---------------------------------------------------------------------------

describe('planGenerator — RANGE_PROGRESSIONS', () => {
  it('has progressions for all 20 baseline field keys', () => {
    const allFields = [
      ...BASELINE_FIELDS[PILLARS.CONVERSION],
      ...BASELINE_FIELDS[PILLARS.ACQUISITION],
      ...BASELINE_FIELDS[PILLARS.RETENTION],
    ];

    for (const key of allFields) {
      assert.ok(RANGE_PROGRESSIONS[key], `Missing progression for: ${key}`);
      assert.ok(RANGE_PROGRESSIONS[key].length >= 2, `Progression too short for: ${key}`);
    }
  });
});
