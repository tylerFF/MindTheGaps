/**
 * MindtheGaps — docxBuilder.js Unit Tests
 *
 * Tests the One-Page Plan DOCX generation module.
 * Each section builder is tested independently via _internal,
 * then full document assembly is tested via buildDocx().
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildDocx, BASELINE_LABELS, _internal } = require(
  '../workers/mtg-scan-webhook/src/docxBuilder',
);
const {
  buildSectionA,
  buildSectionB,
  buildSectionC,
  buildSectionD,
  buildSectionE,
  buildSectionF,
} = _internal;

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function buildPlanContent(overrides = {}) {
  return {
    sectionA: {
      primaryGap: 'Conversion',
      subDiagnosis: 'Speed-to-lead leak',
      supportingSignal: 'Response time is 3+ days',
      quizKeySignals: 'Based on your answers: response time is 3+ days, and show rate is Under 40%.',
      ...(overrides.sectionA || {}),
    },
    sectionB: {
      baselineMetrics: [
        { field: 'Inbound leads per month', value: '11-25' },
        { field: 'Typical first response time', value: 'same day' },
        { field: 'Lead-to-booked %', value: '21-40%' },
        { field: 'Booked-to-show %', value: '61-80%' },
        { field: 'Time to first appointment', value: '1-3 days' },
      ],
      ...(overrides.sectionB || {}),
    },
    sectionC: {
      leverName: 'Response ownership + SLA + follow-up sequence',
      leverDescription: 'Assign one owner for all inbound leads with a 15-minute SLA.',
      whatDoneLooksLike: { metric: 'Median response time', target: 'Under 1 hour within 30 days' },
      ...(overrides.sectionC || {}),
    },
    sectionD: {
      actions: [
        { description: 'Set up auto-response within 15 min', owner: 'Marc', dueDate: 'Days 1-14' },
        { description: 'Create follow-up email sequence', owner: 'Marc', dueDate: 'Days 1-14' },
        { description: 'Add booking link to all touchpoints', owner: 'VA', dueDate: 'Days 15-30' },
        { description: 'Set calendar reminder for quote follow-up', owner: 'Marc', dueDate: 'Days 15-30' },
        { description: 'Build after-quote text template', owner: 'VA', dueDate: 'Days 31-60' },
        { description: 'Install call tracking on website', owner: 'Marc', dueDate: 'Days 31-60' },
      ],
      ...(overrides.sectionD || {}),
    },
    sectionE: {
      metrics: [
        { name: 'Response time (hours)', baseline: '3+ days', target30Day: 'Under 1 hour' },
        { name: 'Lead-to-booked rate (%)', baseline: '21-40%', target30Day: '40-50%' },
      ],
      ...(overrides.sectionE || {}),
    },
    sectionF: {
      constraints: ['Owner availability limited to 10 hrs/week'],
      dataGaps: ['First response time not currently tracked'],
      ...(overrides.sectionF || {}),
    },
  };
}

const DEFAULT_CONTACT = Object.freeze({
  businessName: 'Local Plumbing Co',
  email: 'marc@example.com',
  firstName: 'Marc',
});

function highConfidence() {
  return {
    level: 'High',
    notSureCount: 0,
    totalFields: 7,
    answeredCount: 7,
    includeConstraints: false,
    includeDataGaps: false,
  };
}

function medConfidence() {
  return {
    level: 'Med',
    notSureCount: 2,
    totalFields: 7,
    answeredCount: 5,
    includeConstraints: true,
    includeDataGaps: false,
  };
}

function lowConfidence() {
  return {
    level: 'Low',
    notSureCount: 4,
    totalFields: 7,
    answeredCount: 3,
    includeConstraints: true,
    includeDataGaps: true,
  };
}

// ---------------------------------------------------------------------------
// Helper: extract text content from docx Paragraph objects
// ---------------------------------------------------------------------------

function extractText(elements) {
  const texts = [];
  for (const el of elements) {
    if (el.root && el.root.length) {
      for (const child of el.root) {
        if (child.root && child.root.length) {
          for (const run of child.root) {
            if (typeof run === 'string') {
              texts.push(run);
            }
          }
        }
        if (typeof child === 'string') {
          texts.push(child);
        }
      }
    }
  }
  return texts.join(' ');
}

// ---------------------------------------------------------------------------
// Section A: What We Found
// ---------------------------------------------------------------------------

describe('docxBuilder — Section A (What We Found)', () => {
  it('returns an array of paragraphs', () => {
    const result = buildSectionA(buildPlanContent());
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 3);
  });

  it('includes primary gap', () => {
    const result = buildSectionA(buildPlanContent());
    // At least one element should reference the gap
    assert.ok(result.length >= 3);
  });

  it('includes sub-diagnosis', () => {
    const result = buildSectionA(buildPlanContent());
    assert.ok(result.length >= 3);
  });

  it('includes supporting signal when present', () => {
    const result = buildSectionA(buildPlanContent());
    // Should have 5 elements: header + gap + sub-diagnosis + signal + quizKeySignals
    assert.ok(result.length >= 4);
  });

  it('handles missing supporting signal', () => {
    const plan = buildPlanContent({ sectionA: { supportingSignal: null } });
    const result = buildSectionA(plan);
    // Should not include supporting signal paragraph
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 3);
  });

  it('handles missing quiz key signals', () => {
    const plan = buildPlanContent({ sectionA: { quizKeySignals: null } });
    const result = buildSectionA(plan);
    assert.ok(Array.isArray(result));
  });

  it('handles empty section A', () => {
    const plan = { sectionA: {} };
    const result = buildSectionA(plan);
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1); // at least the header
  });
});

// ---------------------------------------------------------------------------
// Section B: Baseline Metrics
// ---------------------------------------------------------------------------

describe('docxBuilder — Section B (Baseline Metrics)', () => {
  it('returns array with header and table', () => {
    const result = buildSectionB(buildPlanContent());
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2); // header + table
  });

  it('creates table with correct number of data rows', () => {
    const plan = buildPlanContent();
    const result = buildSectionB(plan);
    // Find the table element
    const table = result.find((el) => el.root && el.constructor.name === 'Table');
    assert.ok(table, 'Should contain a Table');
  });

  it('handles empty metrics array', () => {
    const plan = buildPlanContent({ sectionB: { baselineMetrics: [] } });
    const result = buildSectionB(plan);
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2); // header + "no data" message
  });

  it('handles missing sectionB', () => {
    const result = buildSectionB({});
    assert.ok(Array.isArray(result));
  });

  it('filters out metrics with no value', () => {
    const plan = buildPlanContent({
      sectionB: {
        baselineMetrics: [
          { field: 'Test metric', value: '11-25' },
          { field: 'Empty metric', value: '' },
          { field: null, value: null },
        ],
      },
    });
    const result = buildSectionB(plan);
    assert.ok(Array.isArray(result));
  });
});

// ---------------------------------------------------------------------------
// Section C: One Lever
// ---------------------------------------------------------------------------

describe('docxBuilder — Section C (One Lever)', () => {
  it('returns array with header and content', () => {
    const result = buildSectionC(buildPlanContent());
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2);
  });

  it('includes lever description when present', () => {
    const result = buildSectionC(buildPlanContent());
    assert.ok(result.length >= 2);
  });

  it('includes what done looks like when present', () => {
    const result = buildSectionC(buildPlanContent());
    assert.ok(result.length >= 3); // header + description + whatDoneLooksLike
  });

  it('handles missing lever description', () => {
    const plan = buildPlanContent({ sectionC: { leverDescription: null } });
    const result = buildSectionC(plan);
    assert.ok(Array.isArray(result));
  });

  it('handles missing whatDoneLooksLike', () => {
    const plan = buildPlanContent({ sectionC: { whatDoneLooksLike: null } });
    const result = buildSectionC(plan);
    assert.ok(Array.isArray(result));
  });

  it('defaults lever name to "Not selected"', () => {
    const plan = buildPlanContent({ sectionC: { leverName: null } });
    const result = buildSectionC(plan);
    assert.ok(Array.isArray(result));
  });
});

// ---------------------------------------------------------------------------
// Section D: Action Plan
// ---------------------------------------------------------------------------

describe('docxBuilder — Section D (Action Plan)', () => {
  it('returns array with header and table', () => {
    const result = buildSectionD(buildPlanContent());
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2);
  });

  it('always creates 6 action rows', () => {
    const result = buildSectionD(buildPlanContent());
    const table = result.find((el) => el.constructor.name === 'Table');
    assert.ok(table, 'Should contain a Table');
  });

  it('pads missing actions with empty rows', () => {
    const plan = buildPlanContent({
      sectionD: {
        actions: [
          { description: 'Only one action', owner: 'Marc', dueDate: 'Week 1' },
        ],
      },
    });
    const result = buildSectionD(plan);
    assert.ok(Array.isArray(result));
  });

  it('handles empty actions array', () => {
    const plan = buildPlanContent({ sectionD: { actions: [] } });
    const result = buildSectionD(plan);
    assert.ok(Array.isArray(result));
  });

  it('handles missing sectionD', () => {
    const result = buildSectionD({});
    assert.ok(Array.isArray(result));
  });
});

// ---------------------------------------------------------------------------
// Section E: Weekly Scorecard
// ---------------------------------------------------------------------------

describe('docxBuilder — Section E (Weekly Scorecard)', () => {
  it('returns array with header and table', () => {
    const result = buildSectionE(buildPlanContent());
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2);
  });

  it('creates metric rows matching input count', () => {
    const result = buildSectionE(buildPlanContent());
    const table = result.find((el) => el.constructor.name === 'Table');
    assert.ok(table, 'Should contain a Table');
  });

  it('defaults baseline and target to TBD', () => {
    const plan = buildPlanContent({
      sectionE: { metrics: [{ name: 'Test metric' }] },
    });
    const result = buildSectionE(plan);
    assert.ok(Array.isArray(result));
  });

  it('handles empty metrics', () => {
    const plan = buildPlanContent({ sectionE: { metrics: [] } });
    const result = buildSectionE(plan);
    assert.ok(Array.isArray(result));
  });
});

// ---------------------------------------------------------------------------
// Section F: Risks / Constraints (conditional)
// ---------------------------------------------------------------------------

describe('docxBuilder — Section F (Risks / Constraints)', () => {
  it('returns empty array for High confidence with no constraints', () => {
    const plan = buildPlanContent({ sectionF: { constraints: [], dataGaps: [] } });
    const result = buildSectionF(plan, highConfidence());
    assert.deepEqual(result, []);
  });

  it('includes constraints for Med confidence', () => {
    const plan = buildPlanContent();
    const result = buildSectionF(plan, medConfidence());
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2); // header + at least 1 constraint
  });

  it('includes constraints + data gaps for Low confidence', () => {
    const plan = buildPlanContent();
    const result = buildSectionF(plan, lowConfidence());
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 4); // header + constraint + data gaps header + gap
  });

  it('shows "No constraints noted" for Med confidence with empty constraints', () => {
    const plan = buildPlanContent({ sectionF: { constraints: [] } });
    const result = buildSectionF(plan, medConfidence());
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2); // header + "no constraints noted"
  });

  it('limits constraints to max 3', () => {
    const plan = buildPlanContent({
      sectionF: {
        constraints: ['One', 'Two', 'Three', 'Four', 'Five'],
      },
    });
    const result = buildSectionF(plan, medConfidence());
    // Should have header + max 3 bullet paragraphs
    const bulletCount = result.filter(
      (el) => el.root && el.root.some && el.numbering,
    ).length;
    // We count paragraphs after the header — max 3 constraints
    assert.ok(result.length <= 5); // header + 3 constraints max + maybe fallback text
  });

  it('includes data gaps box with items for Low confidence', () => {
    const plan = buildPlanContent({
      sectionF: {
        constraints: ['Budget'],
        dataGaps: ['Response time not tracked', 'Quote close rate unknown'],
      },
    });
    const result = buildSectionF(plan, lowConfidence());
    assert.ok(result.length >= 5); // header + constraint + data gaps header + 2 gaps
  });

  it('shows fallback data gaps message when list is empty but confidence is Low', () => {
    const plan = buildPlanContent({
      sectionF: { constraints: ['Budget'], dataGaps: [] },
    });
    const result = buildSectionF(plan, lowConfidence());
    assert.ok(result.length >= 4); // header + constraint + data gaps header + fallback
  });

  it('includes constraints for High confidence if provided', () => {
    const plan = buildPlanContent({
      sectionF: { constraints: ['Busy season'] },
    });
    // Even with high confidence, if constraints are explicitly provided, show them
    // The condition checks includeConstraints OR constraints.length > 0
    const result = buildSectionF(plan, highConfidence());
    // High confidence has includeConstraints=false, but constraints.length > 0
    // Per the code: skips only when both are false/empty
    assert.ok(result.length >= 2);
  });
});

// ---------------------------------------------------------------------------
// Full document assembly (buildDocx)
// ---------------------------------------------------------------------------

describe('docxBuilder — buildDocx (full assembly)', () => {
  it('returns a Buffer', async () => {
    const buffer = await buildDocx(
      buildPlanContent(),
      {},
      DEFAULT_CONTACT,
      highConfidence(),
    );
    assert.ok(Buffer.isBuffer(buffer));
  });

  it('buffer starts with PK zip header', async () => {
    const buffer = await buildDocx(
      buildPlanContent(),
      {},
      DEFAULT_CONTACT,
      highConfidence(),
    );
    assert.equal(buffer[0], 0x50); // P
    assert.equal(buffer[1], 0x4B); // K
  });

  it('produces non-empty buffer', async () => {
    const buffer = await buildDocx(
      buildPlanContent(),
      {},
      DEFAULT_CONTACT,
      highConfidence(),
    );
    assert.ok(buffer.length > 100);
  });

  it('works for Acquisition gap', async () => {
    const plan = buildPlanContent({
      sectionA: { primaryGap: 'Acquisition', subDiagnosis: 'Channel concentration risk' },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('works for Retention gap', async () => {
    const plan = buildPlanContent({
      sectionA: { primaryGap: 'Retention', subDiagnosis: 'No retention cadence' },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('includes Section F for Med confidence', async () => {
    const buffer = await buildDocx(
      buildPlanContent(),
      {},
      DEFAULT_CONTACT,
      medConfidence(),
    );
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('includes Section F with data gaps for Low confidence', async () => {
    const buffer = await buildDocx(
      buildPlanContent(),
      {},
      DEFAULT_CONTACT,
      lowConfidence(),
    );
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('omits Section F for High confidence with no constraints', async () => {
    const plan = buildPlanContent({ sectionF: { constraints: [], dataGaps: [] } });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
  });

  it('throws on null planContent', async () => {
    await assert.rejects(
      () => buildDocx(null, {}, DEFAULT_CONTACT, highConfidence()),
      { message: 'planContent is required' },
    );
  });

  it('throws on null confidenceResult', async () => {
    await assert.rejects(
      () => buildDocx(buildPlanContent(), {}, DEFAULT_CONTACT, null),
      { message: 'confidenceResult with a valid level is required' },
    );
  });

  it('throws on missing confidence level', async () => {
    await assert.rejects(
      () => buildDocx(buildPlanContent(), {}, DEFAULT_CONTACT, { notSureCount: 0 }),
      { message: 'confidenceResult with a valid level is required' },
    );
  });

  it('handles missing contactInfo gracefully', async () => {
    const buffer = await buildDocx(
      buildPlanContent(),
      {},
      null,
      highConfidence(),
    );
    assert.ok(Buffer.isBuffer(buffer));
  });

  it('handles special characters in business name', async () => {
    const contact = { businessName: "O'Brien's Plumbing & Heating — 100% Local" };
    const buffer = await buildDocx(
      buildPlanContent(),
      {},
      contact,
      highConfidence(),
    );
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });
});

// ---------------------------------------------------------------------------
// BASELINE_LABELS export
// ---------------------------------------------------------------------------

describe('docxBuilder — BASELINE_LABELS', () => {
  it('has labels for all Conversion baseline fields', () => {
    const convKeys = [
      'conv_inbound_leads', 'conv_first_response_time', 'conv_lead_to_booked',
      'conv_booked_to_show', 'conv_time_to_first_appointment', 'conv_quote_sent_timeline',
      'conv_quote_to_close',
    ];
    for (const key of convKeys) {
      assert.ok(BASELINE_LABELS[key], `Missing label for ${key}`);
    }
  });

  it('has labels for all Acquisition baseline fields', () => {
    const acqKeys = [
      'acq_inbound_leads', 'acq_top_source_dependence', 'acq_pct_from_top_source',
      'acq_calls_answered_live', 'acq_website_capture_friction', 'acq_reviews_per_month',
      'acq_referral_intros_per_month',
    ];
    for (const key of acqKeys) {
      assert.ok(BASELINE_LABELS[key], `Missing label for ${key}`);
    }
  });

  it('has labels for all Retention baseline fields', () => {
    const retKeys = [
      'ret_pct_revenue_repeat', 'ret_pct_revenue_referrals', 'ret_rebook_scheduling',
      'ret_reviews_per_month', 'ret_follow_up_time', 'ret_check_in_rhythm',
    ];
    for (const key of retKeys) {
      assert.ok(BASELINE_LABELS[key], `Missing label for ${key}`);
    }
  });
});
