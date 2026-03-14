/**
 * MindtheGaps — Predetermined Scan Actions tests
 *
 * Verifies the three new lookup tables (STEP5_WHAT_WE_FIX, STEP5_HELPER_NARRATION,
 * PREDETERMINED_ACTIONS) and that generatePlan() uses them correctly.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { generatePlan, _internal } = require('../workers/mtg-scan-webhook/src/planGenerator');
const { buildScanData, DEFAULT_ACTIONS, DEFAULT_METRICS } = require('./scanTestCases');

const {
  STEP5_WHAT_WE_FIX,
  STEP5_HELPER_NARRATION,
  PREDETERMINED_ACTIONS,
  MOST_LIKELY_LEAK,
} = _internal;

// ---------------------------------------------------------------------------
// All 14 sub-path keys (must match existing code)
// ---------------------------------------------------------------------------

const STANDARD_SUB_PATHS = [
  'Channel concentration risk',
  'Lead capture friction',
  'Demand capture / local visibility',
  'Speed-to-lead',
  'Booking friction',
  'Show rate',
  'Quote follow-up / decision drop-off',
  'Rebook/recall gap',
  'Review rhythm gap',
  'Referral ask gap',
  'Post-service follow-up gap',
];

const OTHER_MANUAL_SUB_PATHS = [
  'Other (manual):Acquisition',
  'Other (manual):Conversion',
  'Other (manual):Retention',
];

const ALL_SUB_PATHS = [...STANDARD_SUB_PATHS, ...OTHER_MANUAL_SUB_PATHS];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function highConfidence() {
  return { level: 'High', notSureCount: 0, totalFields: 7, answeredCount: 7, includeConstraints: false, includeDataGaps: false };
}

// ---------------------------------------------------------------------------
// STEP5_WHAT_WE_FIX completeness
// ---------------------------------------------------------------------------

describe('STEP5_WHAT_WE_FIX', () => {
  it('has entries for all 14 sub-paths', () => {
    for (const key of ALL_SUB_PATHS) {
      assert.ok(STEP5_WHAT_WE_FIX[key], `Missing STEP5_WHAT_WE_FIX entry for: ${key}`);
    }
  });

  it('each entry is a non-empty string', () => {
    for (const key of ALL_SUB_PATHS) {
      const val = STEP5_WHAT_WE_FIX[key];
      assert.equal(typeof val, 'string');
      assert.ok(val.length > 10, `Entry too short for: ${key}`);
    }
  });

  it('has no extra keys beyond the 14 sub-paths', () => {
    const keys = Object.keys(STEP5_WHAT_WE_FIX);
    assert.equal(keys.length, 14);
  });
});

// ---------------------------------------------------------------------------
// STEP5_HELPER_NARRATION completeness
// ---------------------------------------------------------------------------

describe('STEP5_HELPER_NARRATION', () => {
  it('has entries for all 14 sub-paths', () => {
    for (const key of ALL_SUB_PATHS) {
      assert.ok(STEP5_HELPER_NARRATION[key], `Missing STEP5_HELPER_NARRATION entry for: ${key}`);
    }
  });

  it('each entry is a non-empty string', () => {
    for (const key of ALL_SUB_PATHS) {
      const val = STEP5_HELPER_NARRATION[key];
      assert.equal(typeof val, 'string');
      assert.ok(val.length > 20, `Entry too short for: ${key}`);
    }
  });

  it('each narration starts with expected preamble', () => {
    for (const key of ALL_SUB_PATHS) {
      const val = STEP5_HELPER_NARRATION[key];
      assert.ok(
        val.startsWith('Based on your 12-minute quiz results'),
        `Narration for ${key} does not start with expected preamble`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// PREDETERMINED_ACTIONS completeness and structure
// ---------------------------------------------------------------------------

describe('PREDETERMINED_ACTIONS', () => {
  it('has entries for all 14 sub-paths', () => {
    for (const key of ALL_SUB_PATHS) {
      assert.ok(PREDETERMINED_ACTIONS[key], `Missing PREDETERMINED_ACTIONS entry for: ${key}`);
    }
  });

  it('each sub-path has exactly 6 actions', () => {
    for (const key of ALL_SUB_PATHS) {
      const actions = PREDETERMINED_ACTIONS[key];
      assert.equal(actions.length, 6, `Expected 6 actions for ${key}, got ${actions.length}`);
    }
  });

  it('each action has description, helperNarration, owner, and dueDay', () => {
    for (const key of ALL_SUB_PATHS) {
      const actions = PREDETERMINED_ACTIONS[key];
      actions.forEach((a, i) => {
        assert.ok(a.description, `Missing description for ${key} action ${i + 1}`);
        assert.ok(a.helperNarration, `Missing helperNarration for ${key} action ${i + 1}`);
        assert.ok(a.owner, `Missing owner for ${key} action ${i + 1}`);
        assert.equal(typeof a.dueDay, 'number', `dueDay should be a number for ${key} action ${i + 1}`);
      });
    }
  });

  it('dueDay follows 7/7/21/21/45/45 pattern for all sub-paths', () => {
    const expectedPattern = [7, 7, 21, 21, 45, 45];
    for (const key of ALL_SUB_PATHS) {
      const actions = PREDETERMINED_ACTIONS[key];
      const dueDays = actions.map(a => a.dueDay);
      assert.deepEqual(dueDays, expectedPattern, `Due day pattern mismatch for ${key}`);
    }
  });

  it('owners are valid role names', () => {
    const validOwners = ['Owner/GM', 'Admin/CSR', 'Marketing/Admin', 'Ops lead'];
    for (const key of ALL_SUB_PATHS) {
      const actions = PREDETERMINED_ACTIONS[key];
      actions.forEach((a, i) => {
        assert.ok(
          validOwners.includes(a.owner),
          `Invalid owner "${a.owner}" for ${key} action ${i + 1}`
        );
      });
    }
  });

  it('sub-path keys match MOST_LIKELY_LEAK keys for standard sub-paths', () => {
    const leakKeys = Object.keys(MOST_LIKELY_LEAK);
    for (const key of STANDARD_SUB_PATHS) {
      assert.ok(leakKeys.includes(key), `Sub-path key "${key}" not found in MOST_LIKELY_LEAK`);
    }
  });
});

// ---------------------------------------------------------------------------
// generatePlan() integration: uses predetermined content
// ---------------------------------------------------------------------------

describe('generatePlan() with predetermined actions', () => {
  it('uses STEP5_WHAT_WE_FIX as opener for known sub-path', () => {
    const scanData = buildScanData({
      subPath: 'Speed-to-lead',
      primaryGap: 'Conversion',
      oneLeverSentence: 'Some form sentence',
    });
    const plan = generatePlan(scanData, highConfidence());
    assert.equal(plan.sectionA.opener, STEP5_WHAT_WE_FIX['Speed-to-lead']);
  });

  it('uses predetermined action descriptions for known sub-path', () => {
    const scanData = buildScanData({
      subPath: 'Channel concentration risk',
      primaryGap: 'Acquisition',
    });
    const plan = generatePlan(scanData, highConfidence());
    const expected = PREDETERMINED_ACTIONS['Channel concentration risk'];
    plan.sectionD.actions.forEach((a, i) => {
      assert.equal(a.description, expected[i].description);
    });
  });

  it('uses default owner from lookup when form provides none', () => {
    const scanData = buildScanData({
      subPath: 'Rebook/recall gap',
      primaryGap: 'Retention',
      actions: [
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
      ],
    });
    const plan = generatePlan(scanData, highConfidence());
    const expected = PREDETERMINED_ACTIONS['Rebook/recall gap'];
    plan.sectionD.actions.forEach((a, i) => {
      assert.equal(a.owner, expected[i].owner, `Default owner mismatch at action ${i + 1}`);
    });
  });

  it('allows owner override from form data', () => {
    const scanData = buildScanData({
      subPath: 'Speed-to-lead',
      primaryGap: 'Conversion',
      actions: [
        { description: 'ignored', owner: 'Custom Owner', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
      ],
    });
    const plan = generatePlan(scanData, highConfidence());
    assert.equal(plan.sectionD.actions[0].owner, 'Custom Owner');
    // Other actions should use defaults
    const expected = PREDETERMINED_ACTIONS['Speed-to-lead'];
    assert.equal(plan.sectionD.actions[1].owner, expected[1].owner);
  });

  it('allows dueDate override from form data', () => {
    const scanData = buildScanData({
      subPath: 'Booking friction',
      primaryGap: 'Conversion',
      actions: [
        { description: 'ignored', owner: '', dueDate: 'Week 2' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
        { description: 'ignored', owner: '', dueDate: '' },
      ],
    });
    const plan = generatePlan(scanData, highConfidence());
    assert.equal(plan.sectionD.actions[0].dueDate, 'Week 2');
    assert.equal(plan.sectionD.actions[1].dueDate, 'Day 7');
  });

  it('falls back to form data for unknown sub-path', () => {
    const scanData = buildScanData({
      subPath: 'Unknown sub-path',
      primaryGap: 'Conversion',
      oneLeverSentence: 'Custom opener from form',
    });
    const plan = generatePlan(scanData, highConfidence());
    // Falls back to oneLeverSentence
    assert.equal(plan.sectionA.opener, 'Custom opener from form');
    // Falls back to form actions
    plan.sectionD.actions.forEach((a, i) => {
      assert.equal(a.description, DEFAULT_ACTIONS[i].description);
    });
  });

  it('resolves "Other (manual)" sub-path with pillar suffix', () => {
    const scanData = buildScanData({
      subPath: 'Other (manual)',
      primaryGap: 'Acquisition',
    });
    const plan = generatePlan(scanData, highConfidence());
    assert.equal(plan.sectionA.opener, STEP5_WHAT_WE_FIX['Other (manual):Acquisition']);
    const expected = PREDETERMINED_ACTIONS['Other (manual):Acquisition'];
    plan.sectionD.actions.forEach((a, i) => {
      assert.equal(a.description, expected[i].description);
    });
  });

  it('resolves "Other (manual)" for Conversion pillar', () => {
    const scanData = buildScanData({
      subPath: 'Other (manual)',
      primaryGap: 'Conversion',
    });
    const plan = generatePlan(scanData, highConfidence());
    assert.equal(plan.sectionA.opener, STEP5_WHAT_WE_FIX['Other (manual):Conversion']);
  });

  it('resolves "Other (manual)" for Retention pillar', () => {
    const scanData = buildScanData({
      subPath: 'Other (manual)',
      primaryGap: 'Retention',
    });
    const plan = generatePlan(scanData, highConfidence());
    assert.equal(plan.sectionA.opener, STEP5_WHAT_WE_FIX['Other (manual):Retention']);
  });

  it('action descriptions always come from lookup, never from form', () => {
    const scanData = buildScanData({
      subPath: 'Show rate',
      primaryGap: 'Conversion',
      actions: [
        { description: 'Form description 1', owner: 'Marc', dueDate: 'Week 1' },
        { description: 'Form description 2', owner: 'Marc', dueDate: 'Week 1' },
        { description: 'Form description 3', owner: 'Marc', dueDate: 'Week 3' },
        { description: 'Form description 4', owner: 'Marc', dueDate: 'Week 3' },
        { description: 'Form description 5', owner: 'Marc', dueDate: 'Week 6' },
        { description: 'Form description 6', owner: 'Marc', dueDate: 'Week 6' },
      ],
    });
    const plan = generatePlan(scanData, highConfidence());
    const expected = PREDETERMINED_ACTIONS['Show rate'];
    plan.sectionD.actions.forEach((a, i) => {
      assert.equal(a.description, expected[i].description,
        `Action ${i + 1} description should come from lookup, not form`);
      // But owner should come from form
      assert.equal(a.owner, 'Marc');
    });
  });
});
