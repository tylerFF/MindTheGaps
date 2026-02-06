/**
 * MindtheGaps — Shared Test Fixtures
 *
 * Reusable answer sets for scoring, results, eligibility, and stop-rule tests.
 * Each fixture documents what the expected outcome should be and why.
 */

const { PILLARS } = require('../workers/shared/constants');

// ---------------------------------------------------------------------------
// Helper: build a full answer set from sparse overrides.
// Defaults produce a "neutral" quiz (all 0-point answers).
// ---------------------------------------------------------------------------
const NEUTRAL_ANSWERS = Object.freeze({
  V1: 'Not sure',
  V2: '50+',
  V3: 'Within 15 minutes',
  V4: '80%+',
  V5: 'Three or more sources',
  A1: '16-20',
  C1: 'Owner',
  C2: 'Same day',
  C3: 'Not sure',
  C4: 'Same day',
  R1: 'Monthly',
  R2: 'Grown',
  R3: 'Most revenue comes from existing customers',
});

function buildAnswers(overrides = {}) {
  return { ...NEUTRAL_ANSWERS, ...overrides };
}

// ---------------------------------------------------------------------------
// Fixture 1: Clear Acquisition win
//
// V2 = "0-9" (+2 Acq), V5 = "Most leads come from one source" (+2 Acq),
// A1 = "0-5" (+2 Acq), C3 = "Not the right fit" (+1 Acq)
// Total: Acq=7, Conv=0, Ret=0
// Max Acq = 6 + 1 (C3 routed to Acq) = 7
// Baseline = ROUND(100 * 7/7) = 100
// ---------------------------------------------------------------------------
const CLEAR_ACQUISITION = {
  name: 'Clear Acquisition win',
  answers: buildAnswers({
    V1: 'Getting more leads (Acquisition)',
    V2: '0-9',
    V5: 'Most leads come from one source',
    A1: '0-5',
    C3: 'Not the right fit',
  }),
  expected: {
    primaryGap: PILLARS.ACQUISITION,
    pillarTotals: { Acquisition: 7, Conversion: 0, Retention: 0 },
    baselineScore: 100,
    tieBreakUsed: null,
    c3Route: { pillar: PILLARS.ACQUISITION, points: 1, tag: 'targeting' },
  },
};

// ---------------------------------------------------------------------------
// Fixture 2: Clear Conversion win
//
// V3 = "3+ days" (+2 Conv), V4 = "Under 40%" (+2 Conv),
// C1 = "No consistent owner" (+2 Conv), C2 = "15+ days" (+2 Conv),
// C3 = "Can't reach them / slow follow-up" (+2 Conv), C4 = "90+ days" (+2 Conv)
// Total: Conv=12, Acq=0, Ret=0
// Max Conv = 10 + 2 (C3) = 12
// Baseline = ROUND(100 * 12/12) = 100
// ---------------------------------------------------------------------------
const CLEAR_CONVERSION = {
  name: 'Clear Conversion win',
  answers: buildAnswers({
    V1: 'Turning leads into booked work (Conversion)',
    V3: '3+ days',
    V4: 'Under 40%',
    C1: 'No consistent owner',
    C2: '15+ days',
    C3: "Can't reach them / slow follow-up",
    C4: '90+ days',
  }),
  expected: {
    primaryGap: PILLARS.CONVERSION,
    pillarTotals: { Acquisition: 0, Conversion: 12, Retention: 0 },
    baselineScore: 100,
    tieBreakUsed: null,
    c3Route: { pillar: PILLARS.CONVERSION, points: 2, tag: 'speed/follow-up' },
  },
};

// ---------------------------------------------------------------------------
// Fixture 3: Clear Retention win
//
// R1 = "Rarely/Never" (+2 Ret), R2 = "Shrunk" (+2 Ret),
// R3 = "Most revenue comes from new customers" (+2 Ret)
// Total: Ret=6, Acq=0, Conv=0
// Max Ret = 6 (C3 didn't route to Ret)
// Baseline = ROUND(100 * 6/6) = 100
// ---------------------------------------------------------------------------
const CLEAR_RETENTION = {
  name: 'Clear Retention win',
  answers: buildAnswers({
    V1: 'Getting repeats/referrals (Retention)',
    R1: 'Rarely/Never',
    R2: 'Shrunk',
    R3: 'Most revenue comes from new customers',
  }),
  expected: {
    primaryGap: PILLARS.RETENTION,
    pillarTotals: { Acquisition: 0, Conversion: 0, Retention: 6 },
    baselineScore: 100,
    tieBreakUsed: null,
    c3Route: { pillar: null, points: 0, tag: null },
  },
};

// ---------------------------------------------------------------------------
// Fixture 4: Conversion vs Acquisition tie — Conversion wins via signal
//
// V2 = "10-24" (+1 Acq), V5 = "Two sources" (+1 Acq) → Acq = 2
// V3 = "1-2 days" (+1 Conv), C1 = "Varies" (+1 Conv) → Conv = 2
// Tie between Acq and Conv (both 2).
// Tie-break rule 1: Conversion wins if V3 ∈ slow set OR V4 ∈ low set.
//   V3 = "1-2 days" → yes → Conversion wins.
// Max Conv = 10 (C3 neutral), Baseline = ROUND(100*2/10) = 20
// ---------------------------------------------------------------------------
const TIE_CONV_VS_ACQ_CONV_WINS = {
  name: 'Conv vs Acq tie — Conv wins via V3 signal',
  answers: buildAnswers({
    V1: 'Not sure',
    V2: '10-24',
    V3: '1-2 days',
    V5: 'Two sources',
    C1: 'Varies',
  }),
  expected: {
    primaryGap: PILLARS.CONVERSION,
    pillarTotals: { Acquisition: 2, Conversion: 2, Retention: 0 },
    baselineScore: 20,
    tieBreakUsed: 'conversion_signal',
  },
};

// ---------------------------------------------------------------------------
// Fixture 5: Acquisition vs Retention tie — Acq wins via dual signal
//
// V2 = "0-9" (+2 Acq), V5 = "Most leads come from one source" (+2 Acq) → Acq = 4
// R1 = "Rarely/Never" (+2 Ret), R2 = "Shrunk" (+2 Ret) → Ret = 4
// Tie. Conversion signal check: V3=neutral, V4=neutral → no.
// Acq signal check: V2 ∈ low AND V5 ∈ dependent → yes → Acq wins.
// Max Acq = 6, Baseline = ROUND(100*4/6) = 67
// ---------------------------------------------------------------------------
const TIE_ACQ_VS_RET_ACQ_WINS = {
  name: 'Acq vs Ret tie — Acq wins via dual signal',
  answers: buildAnswers({
    V1: 'Not sure',
    V2: '0-9',
    V5: 'Most leads come from one source',
    R1: 'Rarely/Never',
    R2: 'Shrunk',
  }),
  expected: {
    primaryGap: PILLARS.ACQUISITION,
    pillarTotals: { Acquisition: 4, Conversion: 0, Retention: 4 },
    baselineScore: 67,
    tieBreakUsed: 'acquisition_signal',
  },
};

// ---------------------------------------------------------------------------
// Fixture 6: Three-way tie at 0 — falls through to V1 answer
//
// All answers are neutral (0 points each). V1 = "Getting repeats/referrals (Retention)"
// Tie at 0-0-0. Conv signal: no. Acq signal: no. Ret signal: no.
// V1 → Retention.
// Max Ret = 6, Baseline = ROUND(100*0/6) = 0
// ---------------------------------------------------------------------------
const THREE_WAY_TIE_V1_RETENTION = {
  name: 'Three-way tie at 0 — V1 picks Retention',
  answers: buildAnswers({
    V1: 'Getting repeats/referrals (Retention)',
  }),
  expected: {
    primaryGap: PILLARS.RETENTION,
    pillarTotals: { Acquisition: 0, Conversion: 0, Retention: 0 },
    baselineScore: 0,
    tieBreakUsed: 'v1_answer',
  },
};

// ---------------------------------------------------------------------------
// Fixture 7: Three-way tie at 0 — V1 = "Not sure" → alphabetical fallback
//
// V1 = "Not sure" → alphabetical → "Acquisition" (A < C < R)
// Max Acq = 6, Baseline = 0
// ---------------------------------------------------------------------------
const THREE_WAY_TIE_ALPHABETICAL = {
  name: 'Three-way tie at 0, V1=Not sure → Acquisition (alphabetical)',
  answers: buildAnswers({
    V1: 'Not sure',
  }),
  expected: {
    primaryGap: PILLARS.ACQUISITION,
    pillarTotals: { Acquisition: 0, Conversion: 0, Retention: 0 },
    baselineScore: 0,
    tieBreakUsed: 'alphabetical_fallback',
  },
};

// ---------------------------------------------------------------------------
// Fixture 8: C3 routes to Conversion via "Price objections" (+1)
//
// V3 = "3+ days" (+2 Conv), C3 = "Price objections" (+1 Conv) → Conv = 3
// Max Conv = 10 + 1 = 11
// Baseline = ROUND(100 * 3/11) = 27
// ---------------------------------------------------------------------------
const C3_PRICE_OBJECTIONS = {
  name: 'C3 price objections routes +1 to Conversion',
  answers: buildAnswers({
    V3: '3+ days',
    C3: 'Price objections',
  }),
  expected: {
    primaryGap: PILLARS.CONVERSION,
    pillarTotals: { Acquisition: 0, Conversion: 3, Retention: 0 },
    baselineScore: 27,
    tieBreakUsed: null,
    c3Route: { pillar: PILLARS.CONVERSION, points: 1, tag: 'offer clarity' },
  },
};

// ---------------------------------------------------------------------------
// Fixture 9: C3 routes to Acquisition via "Not the right fit" (+1)
//
// V2 = "0-9" (+2 Acq), C3 = "Not the right fit" (+1 Acq) → Acq = 3
// Max Acq = 6 + 1 = 7
// Baseline = ROUND(100 * 3/7) = 43
// ---------------------------------------------------------------------------
const C3_NOT_RIGHT_FIT = {
  name: 'C3 "Not the right fit" routes +1 to Acquisition',
  answers: buildAnswers({
    V2: '0-9',
    C3: 'Not the right fit',
  }),
  expected: {
    primaryGap: PILLARS.ACQUISITION,
    pillarTotals: { Acquisition: 3, Conversion: 0, Retention: 0 },
    baselineScore: 43,
    tieBreakUsed: null,
    c3Route: { pillar: PILLARS.ACQUISITION, points: 1, tag: 'targeting' },
  },
};

// ---------------------------------------------------------------------------
// Fixture 10: Mixed scenario — moderate scores, Conv wins outright
//
// V2 = "10-24" (+1 Acq), V3 = "1-2 days" (+1 Conv), V4 = "40-59%" (+1 Conv),
// C2 = "8-14 days" (+1 Conv), C3 = "They ghost after the quote" (+2 Conv),
// R1 = "Yearly" (+1 Ret)
// Totals: Acq=1, Conv=5, Ret=1 → Conv wins outright
// Max Conv = 10 + 2 = 12
// Baseline = ROUND(100*5/12) = 42
// ---------------------------------------------------------------------------
const MIXED_CONV_WINS = {
  name: 'Mixed scenario — Conv wins outright',
  answers: buildAnswers({
    V2: '10-24',
    V3: '1-2 days',
    V4: '40-59%',
    C2: '8-14 days',
    C3: 'They ghost after the quote',
    R1: 'Yearly',
  }),
  expected: {
    primaryGap: PILLARS.CONVERSION,
    pillarTotals: { Acquisition: 1, Conversion: 5, Retention: 1 },
    baselineScore: 42,
    tieBreakUsed: null,
    c3Route: { pillar: PILLARS.CONVERSION, points: 2, tag: 'follow-up' },
  },
};

// ---------------------------------------------------------------------------
// Fixture 11: Retention vs Acquisition tie — Ret wins via dual signal
//
// V2 = "10-24" (+1 Acq), A1 = "6-10" (+1 Acq) → Acq = 2
// R1 = "Yearly" (+1 Ret), R3 = "Roughly split" (+1 Ret) → Ret = 2
// Tie at 2-0-2. Conv signal: V3 neutral, V4 neutral → no.
// Acq signal: V2 = "10-24" ∈ low set (yes), but V5 = neutral → miss → no (needs BOTH).
// Ret signal: R1 = "Yearly" ∈ set (yes) AND R3 = "Roughly split" ∈ set (yes) → Ret wins.
// Max Ret = 6 (C3 neutral), Baseline = ROUND(100*2/6) = 33
// ---------------------------------------------------------------------------
const TIE_RET_WINS_VIA_SIGNAL = {
  name: 'Acq vs Ret tie — Ret wins via dual signal',
  answers: buildAnswers({
    V1: 'Not sure',
    V2: '10-24',
    A1: '6-10',
    R1: 'Yearly',
    R3: 'Roughly split between new and existing customers',
  }),
  expected: {
    primaryGap: PILLARS.RETENTION,
    pillarTotals: { Acquisition: 2, Conversion: 0, Retention: 2 },
    baselineScore: 33,
    tieBreakUsed: 'retention_signal',
  },
};

// ---------------------------------------------------------------------------
// Fixture 12: Partial answers (missing some questions)
//
// Only V2 = "0-9" (+2 Acq) provided. Everything else missing.
// Totals: Acq=2, Conv=0, Ret=0 → Acq wins
// C3 not provided → no C3 route → Max Acq = 6
// Baseline = ROUND(100*2/6) = 33
// ---------------------------------------------------------------------------
const PARTIAL_ANSWERS = {
  name: 'Partial answers — only V2 provided',
  answers: { V2: '0-9' },
  expected: {
    primaryGap: PILLARS.ACQUISITION,
    pillarTotals: { Acquisition: 2, Conversion: 0, Retention: 0 },
    baselineScore: 33,
    tieBreakUsed: null,
    c3Route: { pillar: null, points: 0, tag: null },
  },
};

// ---------------------------------------------------------------------------
// Export all fixtures
// ---------------------------------------------------------------------------
module.exports = {
  NEUTRAL_ANSWERS,
  buildAnswers,
  fixtures: {
    CLEAR_ACQUISITION,
    CLEAR_CONVERSION,
    CLEAR_RETENTION,
    TIE_CONV_VS_ACQ_CONV_WINS,
    TIE_ACQ_VS_RET_ACQ_WINS,
    THREE_WAY_TIE_V1_RETENTION,
    THREE_WAY_TIE_ALPHABETICAL,
    C3_PRICE_OBJECTIONS,
    C3_NOT_RIGHT_FIT,
    MIXED_CONV_WINS,
    TIE_RET_WINS_VIA_SIGNAL,
    PARTIAL_ANSWERS,
  },
};
