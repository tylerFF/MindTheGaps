/**
 * MindtheGaps — planGenerator unit tests
 *
 * Tests prompt construction, response parsing, and baseline data filtering.
 * The actual Claude API call is NOT tested here (requires credentials).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { generatePlan, _internal } = require('../workers/mtg-scan-webhook/src/planGenerator');
const { buildScanData, buildBaselineWithNotSure, DEFAULT_ACTIONS, DEFAULT_METRICS } = require('./scanTestCases');
const { PILLARS, BASELINE_FIELDS } = require('../workers/shared/constants');
const { BASELINE_LABELS } = require('../workers/mtg-scan-webhook/src/docxBuilder');

const {
  buildSystemPrompt,
  buildUserPrompt,
  parseResponse,
  buildSectionBData,
  REQUIRED_SECTIONS,
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

function fullPlanContent() {
  return {
    sectionA: { primaryGap: 'Conversion', subDiagnosis: 'Speed-to-lead', supportingSignal: 'Slow follow-up' },
    sectionB: { baselineMetrics: [{ field: 'Response time', value: '3+ days' }] },
    sectionC: { leverName: 'Response ownership', leverDescription: 'Fix response time', whatDoneLooksLike: { metric: 'Response time', target: '<4 hours' } },
    sectionD: { actions: [{ description: 'Set auto-response', owner: 'Marc', dueDate: 'Week 1' }] },
    sectionE: { metrics: [{ name: 'Response time', baseline: '3+ days', target30Day: '<4 hours' }] },
    sectionF: { constraints: [], dataGaps: [] },
  };
}

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe('planGenerator — buildSystemPrompt', () => {
  const prompt = buildSystemPrompt();

  it('returns a non-empty string', () => {
    assert.ok(typeof prompt === 'string');
    assert.ok(prompt.length > 100);
  });

  it('includes the JSON schema contract', () => {
    assert.ok(prompt.includes('sectionA'));
    assert.ok(prompt.includes('sectionB'));
    assert.ok(prompt.includes('sectionC'));
    assert.ok(prompt.includes('sectionD'));
    assert.ok(prompt.includes('sectionE'));
    assert.ok(prompt.includes('sectionF'));
  });

  it('includes content rules', () => {
    assert.ok(prompt.includes('Plain language'));
    assert.ok(prompt.includes('No jargon'));
    assert.ok(prompt.includes('No upsell'));
  });

  it('specifies exactly 6 actions', () => {
    assert.ok(prompt.includes('exactly 6 actions'));
  });

  it('specifies max 3 constraints', () => {
    assert.ok(prompt.includes('max 3'));
  });

  it('mentions confidence-based conditional rules', () => {
    assert.ok(prompt.includes('Medium or Low'));
    assert.ok(prompt.includes('Low'));
  });
});

// ---------------------------------------------------------------------------
// buildUserPrompt
// ---------------------------------------------------------------------------

describe('planGenerator — buildUserPrompt', () => {
  it('includes business profile', () => {
    const scanData = buildScanData();
    const contactInfo = { businessName: 'Test Plumbing', industry: 'HVAC' };
    const prompt = buildUserPrompt(scanData, contactInfo, highConfidence());

    assert.ok(prompt.includes('Test Plumbing'));
    assert.ok(prompt.includes('HVAC'));
  });

  it('includes primary gap and sub-path', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.ACQUISITION, subPath: 'Channel concentration risk' });
    const prompt = buildUserPrompt(scanData, {}, highConfidence());

    assert.ok(prompt.includes('Acquisition'));
    assert.ok(prompt.includes('Channel concentration risk'));
  });

  it('includes one lever', () => {
    const scanData = buildScanData({ oneLever: 'Response ownership + SLA' });
    const prompt = buildUserPrompt(scanData, {}, highConfidence());

    assert.ok(prompt.includes('Response ownership + SLA'));
  });

  it('includes baseline metrics (non-"Not sure" only)', () => {
    const scanData = buildScanData();
    const prompt = buildUserPrompt(scanData, {}, highConfidence());

    // Conv baseline has 7 fields all answered — should see labels
    assert.ok(prompt.includes('Inbound leads per month'));
    assert.ok(prompt.includes('Typical first response time'));
  });

  it('excludes "Not sure" baseline values from prompt', () => {
    const scanData = buildScanData({
      baselineFields: buildBaselineWithNotSure(PILLARS.CONVERSION, 3),
    });
    const prompt = buildUserPrompt(scanData, {}, medConfidence());

    // First 3 fields are "Not sure" — their metric lines should not appear
    // Extract the baseline section between headers
    const baselineSection = prompt.split('## Current Baseline Metrics')[1].split('##')[0];
    assert.ok(!baselineSection.includes('Inbound leads per month'));
    assert.ok(!baselineSection.includes('Typical first response time'));
    assert.ok(!baselineSection.includes('Lead-to-booked'));
    // But should see remaining 4
    assert.ok(baselineSection.includes('Booked-to-show'));
  });

  it('includes all 6 actions', () => {
    const scanData = buildScanData();
    const prompt = buildUserPrompt(scanData, {}, highConfidence());

    assert.ok(prompt.includes('Set up auto-response'));
    assert.ok(prompt.includes('Install call tracking'));
    // Check numbering
    assert.ok(prompt.includes('1.'));
    assert.ok(prompt.includes('6.'));
  });

  it('includes scorecard metrics', () => {
    const scanData = buildScanData();
    const prompt = buildUserPrompt(scanData, {}, highConfidence());

    assert.ok(prompt.includes('Response time (hours)'));
    assert.ok(prompt.includes('Lead-to-booked rate (%)'));
  });

  it('includes confidence level', () => {
    const scanData = buildScanData();

    const highPrompt = buildUserPrompt(scanData, {}, highConfidence());
    assert.ok(highPrompt.includes('Confidence Level: High'));

    const lowPrompt = buildUserPrompt(scanData, {}, lowConfidence());
    assert.ok(lowPrompt.includes('Confidence Level: Low'));
  });

  it('requires constraints instruction for Med confidence', () => {
    const scanData = buildScanData();
    const prompt = buildUserPrompt(scanData, {}, medConfidence());

    assert.ok(prompt.includes('REQUIRED: Include at least 1 constraint'));
  });

  it('requires data gaps instruction for Low confidence', () => {
    const scanData = buildScanData();
    const prompt = buildUserPrompt(scanData, {}, lowConfidence());

    assert.ok(prompt.includes('REQUIRED: Include data gaps to measure'));
  });

  it('marks constraints as optional for High confidence', () => {
    const scanData = buildScanData();
    const prompt = buildUserPrompt(scanData, {}, highConfidence());

    assert.ok(prompt.includes('Constraints are optional'));
  });

  it('uses defaults for missing contactInfo', () => {
    const scanData = buildScanData();
    const prompt = buildUserPrompt(scanData, null, highConfidence());

    assert.ok(prompt.includes('the business'));
    assert.ok(prompt.includes('local service business'));
  });

  it('handles Acquisition pillar', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.ACQUISITION, subPath: 'Channel concentration risk' });
    const prompt = buildUserPrompt(scanData, {}, highConfidence());

    assert.ok(prompt.includes('Acquisition'));
    // Should include Acq baseline labels
    assert.ok(prompt.includes('Top lead source dependence'));
  });

  it('handles Retention pillar', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.RETENTION, subPath: 'Rebook/recall gap' });
    const prompt = buildUserPrompt(scanData, {}, highConfidence());

    assert.ok(prompt.includes('Retention'));
    assert.ok(prompt.includes('revenue from repeat'));
  });
});

// ---------------------------------------------------------------------------
// parseResponse
// ---------------------------------------------------------------------------

describe('planGenerator — parseResponse', () => {
  it('parses valid JSON', () => {
    const json = JSON.stringify(fullPlanContent());
    const result = parseResponse(json);

    assert.equal(result.sectionA.primaryGap, 'Conversion');
    assert.equal(result.sectionC.leverName, 'Response ownership');
  });

  it('parses JSON with markdown fencing', () => {
    const json = '```json\n' + JSON.stringify(fullPlanContent()) + '\n```';
    const result = parseResponse(json);

    assert.equal(result.sectionA.primaryGap, 'Conversion');
  });

  it('parses JSON with plain fencing (no language tag)', () => {
    const json = '```\n' + JSON.stringify(fullPlanContent()) + '\n```';
    const result = parseResponse(json);

    assert.equal(result.sectionA.primaryGap, 'Conversion');
  });

  it('throws on empty input', () => {
    assert.throws(() => parseResponse(''), /Empty or invalid/);
  });

  it('throws on null input', () => {
    assert.throws(() => parseResponse(null), /Empty or invalid/);
  });

  it('throws on non-string input', () => {
    assert.throws(() => parseResponse(123), /Empty or invalid/);
  });

  it('throws on invalid JSON', () => {
    assert.throws(() => parseResponse('not json at all'), /Failed to parse/);
  });

  it('throws when sections are missing', () => {
    const partial = { sectionA: {}, sectionB: {} };
    assert.throws(() => parseResponse(JSON.stringify(partial)), /missing required sections.*sectionC/);
  });

  it('throws listing all missing sections', () => {
    const partial = { sectionA: {} };
    try {
      parseResponse(JSON.stringify(partial));
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('sectionB'));
      assert.ok(err.message.includes('sectionC'));
      assert.ok(err.message.includes('sectionD'));
      assert.ok(err.message.includes('sectionE'));
      assert.ok(err.message.includes('sectionF'));
    }
  });

  it('accepts response with extra whitespace', () => {
    const json = '  \n  ' + JSON.stringify(fullPlanContent()) + '  \n  ';
    const result = parseResponse(json);
    assert.equal(result.sectionA.primaryGap, 'Conversion');
  });

  it('preserves extra fields in sections', () => {
    const plan = fullPlanContent();
    plan.sectionA.extraField = 'bonus data';
    const result = parseResponse(JSON.stringify(plan));
    assert.equal(result.sectionA.extraField, 'bonus data');
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

  it('filters out empty string values', () => {
    const scanData = buildScanData({
      primaryGap: PILLARS.CONVERSION,
      baselineFields: { ...buildBaselineWithNotSure(PILLARS.CONVERSION, 0), conv_inbound_leads: '' },
    });
    const metrics = buildSectionBData(scanData);

    assert.equal(metrics.length, 6);
  });

  it('uses human-readable labels from BASELINE_LABELS', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.CONVERSION });
    const metrics = buildSectionBData(scanData);

    const firstField = metrics[0].field;
    assert.ok(firstField.includes(' '), 'Label should be human-readable, not a field key');
  });

  it('works for Acquisition pillar', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.ACQUISITION });
    const metrics = buildSectionBData(scanData);

    assert.equal(metrics.length, 7);
    assert.ok(metrics.some((m) => m.field.includes('lead source')));
  });

  it('works for Retention pillar', () => {
    const scanData = buildScanData({ primaryGap: PILLARS.RETENTION });
    const metrics = buildSectionBData(scanData);

    assert.equal(metrics.length, 6); // Retention has 6 fields
    assert.ok(metrics.some((m) => m.field.includes('repeat')));
  });

  it('returns empty array for unknown pillar', () => {
    const scanData = { primaryGap: 'FakePillar', baselineFields: {} };
    const metrics = buildSectionBData(scanData);

    assert.equal(metrics.length, 0);
  });

  it('handles missing baselineFields gracefully', () => {
    const scanData = { primaryGap: PILLARS.CONVERSION };
    const metrics = buildSectionBData(scanData);

    assert.equal(metrics.length, 0);
  });

  it('handles case-insensitive "Not sure" filtering', () => {
    const scanData = buildScanData({
      primaryGap: PILLARS.CONVERSION,
      baselineFields: { ...buildBaselineWithNotSure(PILLARS.CONVERSION, 0), conv_inbound_leads: 'NOT SURE' },
    });
    const metrics = buildSectionBData(scanData);

    assert.equal(metrics.length, 6);
  });
});

// ---------------------------------------------------------------------------
// generatePlan — API call (error paths only, no real API)
// ---------------------------------------------------------------------------

describe('planGenerator — generatePlan', () => {
  it('throws when CLAUDE_API_KEY is missing', async () => {
    const scanData = buildScanData();
    await assert.rejects(
      () => generatePlan(scanData, {}, highConfidence(), {}),
      /CLAUDE_API_KEY is required/,
    );
  });

  it('throws when env is null', async () => {
    const scanData = buildScanData();
    await assert.rejects(
      () => generatePlan(scanData, {}, highConfidence(), null),
      /CLAUDE_API_KEY is required/,
    );
  });
});

// ---------------------------------------------------------------------------
// REQUIRED_SECTIONS constant
// ---------------------------------------------------------------------------

describe('planGenerator — REQUIRED_SECTIONS', () => {
  it('has exactly 6 required sections', () => {
    assert.equal(REQUIRED_SECTIONS.length, 6);
  });

  it('matches the planContent shape', () => {
    const expected = ['sectionA', 'sectionB', 'sectionC', 'sectionD', 'sectionE', 'sectionF'];
    assert.deepEqual(REQUIRED_SECTIONS, expected);
  });
});
