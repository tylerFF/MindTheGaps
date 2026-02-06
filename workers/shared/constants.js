/**
 * MindtheGaps — Shared Constants
 *
 * Single source of truth for pillar names, question IDs, scoring rules,
 * answer option values, and HubSpot field name prefixes.
 *
 * Every other module imports from here — no magic strings elsewhere.
 */

// ---------------------------------------------------------------------------
// Pillar enum
// ---------------------------------------------------------------------------
const PILLARS = Object.freeze({
  ACQUISITION: 'Acquisition',
  CONVERSION: 'Conversion',
  RETENTION: 'Retention',
});

// ---------------------------------------------------------------------------
// Question IDs (in quiz order)
// ---------------------------------------------------------------------------
const QUESTION_IDS = Object.freeze([
  'V1', 'V2', 'V3', 'V4', 'V5',
  'A1',
  'C1', 'C2', 'C3', 'C4',
  'R1', 'R2', 'R3',
]);

// ---------------------------------------------------------------------------
// Scoring rules — keyed by question ID
//
// Each rule has:
//   pillar  – target pillar (null for V1, 'MIXED' for C3)
//   points  – map of answer text → point value
//
// Answers not listed score 0.
// ---------------------------------------------------------------------------
const SCORING_RULES = Object.freeze({
  V1: {
    pillar: null, // non-scoring, tie-break only
    points: {},
  },

  V2: {
    pillar: PILLARS.ACQUISITION,
    points: {
      '0-9': 2,
      '10-24': 1,
    },
  },

  V3: {
    pillar: PILLARS.CONVERSION,
    points: {
      '3+ days': 2,
      '1-2 days': 1,
    },
  },

  V4: {
    pillar: PILLARS.CONVERSION,
    points: {
      'Under 40%': 2,
      '40-59%': 1,
    },
  },

  V5: {
    pillar: PILLARS.ACQUISITION,
    points: {
      'Most leads come from one source': 2,
      'Two sources': 1,
    },
  },

  A1: {
    pillar: PILLARS.ACQUISITION,
    points: {
      '0-5': 2,
      '6-10': 1,
    },
  },

  C1: {
    pillar: PILLARS.CONVERSION,
    points: {
      'No consistent owner': 2,
      'Varies': 1,
    },
  },

  C2: {
    pillar: PILLARS.CONVERSION,
    points: {
      '15+ days': 2,
      '8-14 days': 1,
    },
  },

  // C3 is special — pillar depends on the answer chosen
  C3: {
    pillar: 'MIXED',
    routes: {
      "Can't reach them / slow follow-up": { pillar: PILLARS.CONVERSION, points: 2, tag: 'speed/follow-up' },
      'They ghost after the quote':        { pillar: PILLARS.CONVERSION, points: 2, tag: 'follow-up' },
      'Price objections':                  { pillar: PILLARS.CONVERSION, points: 1, tag: 'offer clarity' },
      'Not the right fit':                 { pillar: PILLARS.ACQUISITION, points: 1, tag: 'targeting' },
      'Not sure':                          { pillar: null, points: 0, tag: null },
    },
  },

  C4: {
    pillar: PILLARS.CONVERSION,
    points: {
      '90+ days': 2,
      '31-90 days': 1,
    },
  },

  R1: {
    pillar: PILLARS.RETENTION,
    points: {
      'Rarely/Never': 2,
      'Yearly': 1,
    },
  },

  R2: {
    pillar: PILLARS.RETENTION,
    points: {
      'Shrunk': 2,
      'Flat': 1,
    },
  },

  R3: {
    pillar: PILLARS.RETENTION,
    points: {
      'Most revenue comes from new customers': 2,
      'Roughly split between new and existing customers': 1,
    },
  },
});

// ---------------------------------------------------------------------------
// V1 answer → pillar mapping (final tie-break)
// ---------------------------------------------------------------------------
const V1_TIEBREAK_MAP = Object.freeze({
  'Getting more leads (Acquisition)': PILLARS.ACQUISITION,
  'Turning leads into booked work (Conversion)': PILLARS.CONVERSION,
  'Getting repeats/referrals (Retention)': PILLARS.RETENTION,
  // "Not sure" handled separately — pick first alphabetically among tied
});

// ---------------------------------------------------------------------------
// Tie-break signal thresholds
//
// Used by the tie-break engine to check whether specific answer values
// indicate a strong signal for a pillar.
// ---------------------------------------------------------------------------
const TIEBREAK_SIGNALS = Object.freeze({
  [PILLARS.CONVERSION]: {
    // Conversion wins tie if V3 shows slow response OR V4 shows low show rate
    V3: ['1-2 days', '3+ days'],
    V4: ['Under 40%', '40-59%'],
  },
  [PILLARS.ACQUISITION]: {
    // Acquisition wins tie if V2 shows low volume AND V5 shows source dependence
    V2: ['0-9', '10-24'],
    V5: ['Most leads come from one source', 'Two sources'],
  },
  [PILLARS.RETENTION]: {
    // Retention wins tie if R1 shows infrequent reviews AND R3 shows new-customer reliance
    R1: ['Yearly', 'Rarely/Never'],
    R3: ['Most revenue comes from new customers', 'Roughly split between new and existing customers'],
  },
});

// ---------------------------------------------------------------------------
// HubSpot property prefix
// ---------------------------------------------------------------------------
const HUBSPOT_PREFIX = 'mtg_';

// ---------------------------------------------------------------------------
// Quiz raw-answer HubSpot field names
// ---------------------------------------------------------------------------
const QUIZ_FIELD_NAMES = Object.freeze(
  QUESTION_IDS.map((id) => `${HUBSPOT_PREFIX}quiz_${id.toLowerCase()}`),
);

module.exports = {
  PILLARS,
  QUESTION_IDS,
  SCORING_RULES,
  V1_TIEBREAK_MAP,
  TIEBREAK_SIGNALS,
  HUBSPOT_PREFIX,
  QUIZ_FIELD_NAMES,
};
