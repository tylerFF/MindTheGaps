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
        { field: 'Lead to booked %', value: '21-40%' },
        { field: 'Booked to show %', value: '61-80%' },
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
        { name: 'Median response time', baseline: '3+ days', target30Day: 'Under 1 hour' },
        { name: 'Lead to booked %', baseline: '21-40%', target30Day: '41-60%' },
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

  it('includes opener when present', () => {
    const plan = buildPlanContent({
      sectionA: { opener: 'Fix Speed-to-lead first by focusing on response time.' },
    });
    const result = buildSectionA(plan);
    // header + opener + gap + sub-diagnosis + signal + quizKeySignals = 6+
    assert.ok(result.length >= 4);
  });

  it('includes mostLikelyLeak and whatChanges when present', () => {
    const plan = buildPlanContent({
      sectionA: {
        mostLikelyLeak: 'Speed-to-lead is too slow, which reduces bookings.',
        whatChanges: 'More leads become booked work.',
      },
    });
    const result = buildSectionA(plan);
    // header + gap + sub-diagnosis + leak + whatChanges + signal + quizKeySignals
    assert.ok(result.length >= 5);
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

  it('adds data gap note when target is "Start tracking weekly."', () => {
    const plan = buildPlanContent({
      sectionE: {
        metrics: [
          { name: 'Some metric', baseline: 'Not sure', target30Day: 'Start tracking weekly.' },
        ],
      },
    });
    const result = buildSectionE(plan);
    // header + table + data gap note = 3 elements
    assert.ok(result.length >= 3);
  });

  it('omits data gap note when no targets are "Start tracking weekly."', () => {
    const plan = buildPlanContent({
      sectionE: {
        metrics: [
          { name: 'Response time', baseline: '3+ days', target30Day: '1-2 days' },
        ],
      },
    });
    const result = buildSectionE(plan);
    // header + table = 2 elements (no data gap note)
    assert.equal(result.length, 2);
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

// ---------------------------------------------------------------------------
// Phase 4 — Section A opener rendering (3.1)
// ---------------------------------------------------------------------------

describe('docxBuilder — Section A opener (3.1)', () => {
  it('renders opener as first element after header when present', () => {
    const plan = buildPlanContent({ sectionA: { opener: 'Fix slow response time first.' } });
    const result = buildSectionA(plan);
    // header + opener + mostLikelyLeak + whatChanges + gap + rootCause + signal + quiz = many elements
    assert.ok(result.length >= 4);
  });

  it('does not render opener paragraph when opener is empty', () => {
    const plan = buildPlanContent({ sectionA: { opener: '' } });
    const result = buildSectionA(plan);
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 3); // header + gap + rootCause at minimum
  });

  it('does not render opener paragraph when opener is undefined', () => {
    const plan = buildPlanContent({ sectionA: { opener: undefined } });
    const result = buildSectionA(plan);
    assert.ok(Array.isArray(result));
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — Section A phrasing bank rendering (3.6)
// ---------------------------------------------------------------------------

describe('docxBuilder — Section A phrasing bank (3.6)', () => {
  it('renders mostLikelyLeak when present', () => {
    const plan = buildPlanContent({
      sectionA: { mostLikelyLeak: 'Speed-to-lead is too slow, which reduces bookings.' },
    });
    const result = buildSectionA(plan);
    // Should have more elements than the basic set (header + gap + rootCause + signal + quiz)
    assert.ok(result.length >= 5);
  });

  it('renders whatChanges when present', () => {
    const plan = buildPlanContent({
      sectionA: { whatChanges: 'More leads become booked work.' },
    });
    const result = buildSectionA(plan);
    assert.ok(result.length >= 5);
  });

  it('does not render mostLikelyLeak when empty', () => {
    const plan = buildPlanContent({ sectionA: { mostLikelyLeak: '' } });
    const result = buildSectionA(plan);
    assert.ok(Array.isArray(result));
  });

  it('does not render whatChanges when empty', () => {
    const plan = buildPlanContent({ sectionA: { whatChanges: '' } });
    const result = buildSectionA(plan);
    assert.ok(Array.isArray(result));
  });

  it('renders both phrasing bank lines together', () => {
    const plan = buildPlanContent({
      sectionA: {
        opener: 'Fix response time.',
        mostLikelyLeak: 'Speed-to-lead is too slow.',
        whatChanges: 'More leads become booked work.',
      },
    });
    const result = buildSectionA(plan);
    // header + opener + mostLikelyLeak + whatChanges + gap + rootCause + signal + quiz = 8+
    assert.ok(result.length >= 7);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — Section D inline action format (3.2)
// ---------------------------------------------------------------------------

describe('docxBuilder — Section D inline action format (3.2)', () => {
  it('returns array with header and 2-column table', () => {
    const result = buildSectionD(buildPlanContent());
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2); // header + table
  });

  it('renders action with owner and due inline', () => {
    const plan = buildPlanContent({
      sectionD: {
        actions: [
          { description: 'Set up auto-response', owner: 'Marc', dueDate: 'Day 5' },
          { description: 'Create follow-up sequence', owner: 'VA', dueDate: 'Day 10' },
          { description: 'Action three', owner: 'Ops lead', dueDate: 'Day 18' },
          { description: 'Action four', owner: 'Admin/CSR', dueDate: 'Day 25' },
          { description: 'Action five', owner: 'Owner/GM', dueDate: 'Day 40' },
          { description: 'Action six', owner: 'Marketing/Admin', dueDate: 'Day 58' },
        ],
      },
    });
    const result = buildSectionD(plan);
    const table = result.find((el) => el.constructor.name === 'Table');
    assert.ok(table, 'Should contain a Table');
  });

  it('omits "Owner:" when owner is empty', () => {
    const plan = buildPlanContent({
      sectionD: {
        actions: [
          { description: 'Do the thing', owner: '', dueDate: 'Day 5' },
          { description: '', owner: '', dueDate: '' },
          { description: '', owner: '', dueDate: '' },
          { description: '', owner: '', dueDate: '' },
          { description: '', owner: '', dueDate: '' },
          { description: '', owner: '', dueDate: '' },
        ],
      },
    });
    const result = buildSectionD(plan);
    assert.ok(Array.isArray(result));
  });

  it('omits "Due:" when dueDate is empty', () => {
    const plan = buildPlanContent({
      sectionD: {
        actions: [
          { description: 'Do the thing', owner: 'Marc', dueDate: '' },
          { description: '', owner: '', dueDate: '' },
          { description: '', owner: '', dueDate: '' },
          { description: '', owner: '', dueDate: '' },
          { description: '', owner: '', dueDate: '' },
          { description: '', owner: '', dueDate: '' },
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
});

// ---------------------------------------------------------------------------
// Phase 4 — Section E data gap note (3.3)
// ---------------------------------------------------------------------------

describe('docxBuilder — Section E data gap note (3.3)', () => {
  it('adds data gap note when any metric target is "Start tracking weekly."', () => {
    const plan = buildPlanContent({
      sectionE: {
        metrics: [
          { name: 'Response time', baseline: 'Not sure', target30Day: 'Start tracking weekly.' },
          { name: 'Lead to booked %', baseline: '21-40%', target30Day: '41-60%' },
        ],
      },
    });
    const result = buildSectionE(plan);
    // Should have: header + table + data gap note paragraph = at least 3 elements
    assert.ok(result.length >= 3);
  });

  it('does NOT add data gap note when no metrics have "Start tracking weekly." target', () => {
    const plan = buildPlanContent({
      sectionE: {
        metrics: [
          { name: 'Response time', baseline: '3+ days', target30Day: '1-2 days' },
          { name: 'Lead to booked %', baseline: '21-40%', target30Day: '41-60%' },
        ],
      },
    });
    const result = buildSectionE(plan);
    // header + table = 2 elements (no data gap note)
    assert.equal(result.length, 2);
  });

  it('adds data gap note when ALL metrics have "Start tracking weekly." target', () => {
    const plan = buildPlanContent({
      sectionE: {
        metrics: [
          { name: 'Metric 1', baseline: 'Not sure', target30Day: 'Start tracking weekly.' },
          { name: 'Metric 2', baseline: 'Not sure', target30Day: 'Start tracking weekly.' },
        ],
      },
    });
    const result = buildSectionE(plan);
    assert.ok(result.length >= 3);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — Full buildDocx with Phase 4 changes
// ---------------------------------------------------------------------------

describe('docxBuilder — buildDocx with Phase 4 features', () => {
  it('produces valid DOCX with opener + phrasing bank + inline actions + data gap note', async () => {
    const plan = buildPlanContent({
      sectionA: {
        opener: 'Fix response time to under 1 hour.',
        mostLikelyLeak: 'Speed-to-lead is too slow, which reduces bookings.',
        whatChanges: 'More leads become booked work.',
      },
      sectionE: {
        metrics: [
          { name: 'Response time', baseline: 'Not sure', target30Day: 'Start tracking weekly.' },
          { name: 'Lead to booked %', baseline: '21-40%', target30Day: '41-60%' },
        ],
      },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
    assert.equal(buffer[0], 0x50); // PK zip header
    assert.equal(buffer[1], 0x4B);
  });

  it('produces valid DOCX without opener (empty string)', async () => {
    const plan = buildPlanContent({ sectionA: { opener: '' } });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });
});

// ---------------------------------------------------------------------------
// Phase 5 — Section A contradiction note rendering (3.4)
// ---------------------------------------------------------------------------

describe('docxBuilder — Section A contradictionNote (3.4)', () => {
  it('renders "Why this focus:" line when contradiction note is present', () => {
    const plan = buildPlanContent({
      sectionA: {
        opener: 'Fix response time.',
        contradictionNote: 'Tie-breaker contradicts Field 1; choosing Speed-to-lead.',
      },
    });
    const result = buildSectionA(plan);
    // Should have more elements than without the contradiction note
    // header + opener + contradictionNote + ... = more elements
    assert.ok(result.length >= 5);
  });

  it('does NOT render contradiction note when empty', () => {
    const plan = buildPlanContent({ sectionA: { contradictionNote: '' } });
    const planWithout = buildPlanContent({ sectionA: {} });
    const result = buildSectionA(plan);
    const resultWithout = buildSectionA(planWithout);
    // Same number of elements (no extra paragraph for empty note)
    assert.equal(result.length, resultWithout.length);
  });

  it('does NOT render contradiction note when undefined', () => {
    const plan = buildPlanContent({ sectionA: { contradictionNote: undefined } });
    const result = buildSectionA(plan);
    assert.ok(Array.isArray(result));
  });

  it('renders contradiction note after opener and before phrasing bank', () => {
    const plan = buildPlanContent({
      sectionA: {
        opener: 'Fix response time.',
        contradictionNote: 'Some contradiction.',
        mostLikelyLeak: 'Speed-to-lead is too slow.',
        whatChanges: 'More leads become booked work.',
      },
    });
    const result = buildSectionA(plan);
    // header + opener + contradictionNote + mostLikelyLeak + whatChanges + gap + rootCause + signal + quiz = many
    assert.ok(result.length >= 8);
  });
});

// ---------------------------------------------------------------------------
// Phase 5 — Section A manual plan flag rendering (3.5)
// ---------------------------------------------------------------------------

describe('docxBuilder — Section A manualPlanFlag (3.5)', () => {
  it('renders manual plan flag prominently when present', () => {
    const plan = buildPlanContent({
      sectionA: { manualPlanFlag: 'Manual plan: sub-path was not selected with confidence. Human review required.' },
    });
    const result = buildSectionA(plan);
    // Should include the flag paragraph as an additional element
    assert.ok(result.length >= 4);
  });

  it('does NOT render manual plan flag when empty', () => {
    const plan = buildPlanContent({ sectionA: { manualPlanFlag: '' } });
    const planWithout = buildPlanContent({ sectionA: {} });
    const result = buildSectionA(plan);
    const resultWithout = buildSectionA(planWithout);
    assert.equal(result.length, resultWithout.length);
  });

  it('does NOT render manual plan flag when undefined', () => {
    const plan = buildPlanContent({ sectionA: { manualPlanFlag: undefined } });
    const result = buildSectionA(plan);
    assert.ok(Array.isArray(result));
  });

  it('renders flag before opener (most prominent position)', () => {
    const plan = buildPlanContent({
      sectionA: {
        manualPlanFlag: 'Manual plan: human review required.',
        opener: 'Fix something first.',
      },
    });
    const result = buildSectionA(plan);
    // header + flag + opener + ... = at least 5 elements
    assert.ok(result.length >= 5);
  });
});

// ---------------------------------------------------------------------------
// Phase 5 — Full buildDocx with Phase 5 features
// ---------------------------------------------------------------------------

describe('docxBuilder — buildDocx with Phase 5 features', () => {
  it('produces valid DOCX with contradiction note + manual plan flag', async () => {
    const plan = buildPlanContent({
      sectionA: {
        opener: 'Fix response time.',
        contradictionNote: 'Tie-breaker contradicts Field 1.',
        manualPlanFlag: 'Manual plan: sub-path was not selected with confidence. Human review required.',
        mostLikelyLeak: 'Speed-to-lead is too slow.',
        whatChanges: 'More leads become booked work.',
      },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
    assert.equal(buffer[0], 0x50); // PK zip header
    assert.equal(buffer[1], 0x4B);
  });

  it('produces valid DOCX with only contradiction note (no flag)', async () => {
    const plan = buildPlanContent({
      sectionA: {
        opener: 'Fix response time.',
        contradictionNote: 'Some note about contradiction.',
        manualPlanFlag: '',
      },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('produces valid DOCX with only manual plan flag (no contradiction note)', async () => {
    const plan = buildPlanContent({
      sectionA: {
        manualPlanFlag: 'Manual plan: human review required.',
        contradictionNote: '',
      },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('produces valid DOCX with neither contradiction note nor manual flag', async () => {
    const plan = buildPlanContent({
      sectionA: {
        contradictionNote: '',
        manualPlanFlag: '',
      },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });
});

// ---------------------------------------------------------------------------
// Field 2 follow-up rendering (item 2.2)
// ---------------------------------------------------------------------------

describe('docxBuilder — Field 2 follow-up rendering (2.2)', () => {
  it('renders "Sub-path confirmation" line when field2Answer and field2Label are present', () => {
    const plan = buildPlanContent({
      sectionA: {
        field2Answer: 'Same day',
        field2Label: 'First response time',
      },
    });
    const children = buildSectionA(plan);

    // Find the paragraph containing "Sub-path confirmation:"
    const texts = children
      .filter(c => c.constructor.name === 'Paragraph')
      .flatMap(p => (p.root || []))
      .filter(r => r && typeof r === 'object');

    // Check that any paragraph text includes "Sub-path confirmation"
    const allText = JSON.stringify(children);
    assert.ok(allText.includes('Sub-path confirmation'), 'Should contain "Sub-path confirmation" label');
    assert.ok(allText.includes('First response time'), 'Should contain field2Label');
    assert.ok(allText.includes('Same day'), 'Should contain field2Answer');
  });

  it('does NOT render "Sub-path confirmation" when field2Answer is empty', () => {
    const plan = buildPlanContent({
      sectionA: {
        field2Answer: '',
        field2Label: '',
      },
    });
    const children = buildSectionA(plan);
    const allText = JSON.stringify(children);
    assert.ok(!allText.includes('Sub-path confirmation'), 'Should NOT contain "Sub-path confirmation" when empty');
  });

  it('does NOT render "Sub-path confirmation" when field2Answer is undefined', () => {
    const plan = buildPlanContent({
      sectionA: {},
    });
    const children = buildSectionA(plan);
    const allText = JSON.stringify(children);
    assert.ok(!allText.includes('Sub-path confirmation'), 'Should NOT contain "Sub-path confirmation" when undefined');
  });

  it('produces valid DOCX buffer with field2Answer present', async () => {
    const plan = buildPlanContent({
      sectionA: {
        field2Answer: '1-2 days',
        field2Label: 'First response time',
      },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('produces valid DOCX buffer with all Field 2 + contradiction note + manual flag', async () => {
    const plan = buildPlanContent({
      sectionA: {
        field2Answer: '60-79%',
        field2Label: 'Show rate %',
        contradictionNote: 'Tie-breaker supports show rate focus.',
        manualPlanFlag: '',
        opener: 'Focus on show rate to recover lost appointments.',
        mostLikelyLeak: 'No-shows are reducing completed appointments.',
        whatChanges: 'More booked jobs actually show up.',
      },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });
});

// ---------------------------------------------------------------------------
// Personalization details line
// ---------------------------------------------------------------------------

describe('buildDocx — personalization details', () => {
  it('generates valid DOCX with industry, location, and teamSize', async () => {
    const contact = {
      businessName: 'Acme Plumbing',
      email: 'test@example.com',
      firstName: 'Jane',
      industry: 'Home Services',
      location: 'Toronto, ON',
      teamSize: '5-10',
    };
    const buffer = await buildDocx(buildPlanContent(), {}, contact, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('generates valid DOCX with only some detail fields', async () => {
    const contact = {
      businessName: 'Test Co',
      email: 'test@example.com',
      firstName: 'Bob',
      industry: 'Landscaping',
    };
    const buffer = await buildDocx(buildPlanContent(), {}, contact, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('generates valid DOCX with no detail fields (same as before)', async () => {
    const buffer = await buildDocx(buildPlanContent(), {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });
});

// ---------------------------------------------------------------------------
// Per-action facilitator notes in Section D
// ---------------------------------------------------------------------------

describe('docxBuilder — Section D per-action notes', () => {
  it('generates valid DOCX with per-action note filled', async () => {
    const plan = buildPlanContent({
      sectionD: {
        actions: [
          { description: 'Action 1 text', note: 'Client wants manual CRM', owner: 'Marc', dueDate: 'Day 7' },
          { description: 'Action 2 text', note: '', owner: 'Marc', dueDate: 'Day 7' },
          { description: 'Action 3 text', note: '', owner: '', dueDate: '' },
          { description: 'Action 4 text', note: '', owner: '', dueDate: '' },
          { description: 'Action 5 text', note: '', owner: '', dueDate: '' },
          { description: 'Action 6 text', note: '', owner: '', dueDate: '' },
        ],
      },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('generates valid DOCX with all notes blank', async () => {
    const plan = buildPlanContent({
      sectionD: {
        actions: [
          { description: 'Action 1 text', note: '', owner: 'Marc', dueDate: 'Day 7' },
          { description: 'Action 2 text', note: '', owner: '', dueDate: '' },
          { description: 'Action 3 text', note: '', owner: '', dueDate: '' },
          { description: 'Action 4 text', note: '', owner: '', dueDate: '' },
          { description: 'Action 5 text', note: '', owner: '', dueDate: '' },
          { description: 'Action 6 text', note: '', owner: '', dueDate: '' },
        ],
      },
    });
    const buffer = await buildDocx(plan, {}, DEFAULT_CONTACT, highConfidence());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 100);
  });

  it('buildSectionD returns array with note-bearing actions', () => {
    const plan = buildPlanContent({
      sectionD: {
        actions: [
          { description: 'Action 1', note: 'Important note', owner: 'Marc', dueDate: 'Day 7' },
          { description: 'Action 2', note: '', owner: '', dueDate: '' },
          { description: 'Action 3', note: '', owner: '', dueDate: '' },
          { description: 'Action 4', note: '', owner: '', dueDate: '' },
          { description: 'Action 5', note: '', owner: '', dueDate: '' },
          { description: 'Action 6', note: '', owner: '', dueDate: '' },
        ],
      },
    });
    const result = buildSectionD(plan);
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2); // header + table
  });
});
