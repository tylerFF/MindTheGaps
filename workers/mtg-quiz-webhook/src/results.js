/**
 * MindtheGaps — Results Content Generator
 *
 * Pure functions that take a ScoringResult + raw answers and produce
 * all the text / data needed for the results page and HubSpot fields.
 *
 * Public API:
 *   generateResults(scoringResult, answers) → ResultsContent
 *
 * ResultsContent shape:
 *   {
 *     primaryGapStatement: string,
 *     subDiagnosis:        string,        // e.g. "Speed-to-lead leak"
 *     subDiagnosisDisplay: string,        // human-friendly sentence
 *     keySignals:          string[],      // 1-2 signal strings
 *     keySignalsLine:      string,        // formatted "Based on your answers: ..."
 *     costOfLeak:          string,        // e.g. "Often 10-30% of leads leak before booking"
 *     costOfLeakAdvice:    string,        // how-to-say-it text
 *     fastestNextSteps:    string[],      // 2 bullet strings
 *   }
 */

const { PILLARS, SCORING_RULES } = require('../../shared/constants');

// ---------------------------------------------------------------------------
// Sub-diagnosis definitions
// ---------------------------------------------------------------------------

/**
 * Each sub-diagnosis entry:
 *   name      – internal name (stored in HubSpot)
 *   display   – sentence shown to the prospect
 *   condition – function(answers) → boolean
 *   scoreKey  – question ID whose points determined this (for priority)
 */

const SUB_DIAGNOSES = {
  [PILLARS.ACQUISITION]: [
    {
      name: 'Demand shortfall',
      display: 'Lead volume is too low to hit growth targets (demand shortfall).',
      condition: (a) => ['0-9', '10-24'].includes(a.V2),
      scoreKey: 'V2',
    },
    {
      name: 'Channel concentration risk',
      display: "You're exposed to a single source of leads (concentration risk).",
      condition: (a) => a.V5 === 'Most leads come from one source',
      scoreKey: 'V5',
    },
    {
      name: 'Lead quality mismatch',
      display: 'Too many leads are not a fit (lead quality mismatch).',
      condition: (a) => ['0-5', '6-10'].includes(a.A1),
      scoreKey: 'A1',
    },
  ],

  [PILLARS.CONVERSION]: [
    {
      name: 'Speed-to-lead leak',
      display: 'Speed is the leak: leads wait too long for a first response.',
      condition: (a) => ['1-2 days', '3+ days'].includes(a.V3),
      scoreKey: 'V3',
    },
    {
      name: 'Ownership leak',
      display: "Ownership is the leak: there's no consistent first responder.",
      condition: (a) => a.C1 === 'No consistent owner',
      scoreKey: 'C1',
    },
    {
      name: 'Booking friction leak',
      display: 'Booking is the leak: it takes too long to get to a first meeting.',
      condition: (a) => ['8-14 days', '15+ days'].includes(a.C2),
      scoreKey: 'C2',
    },
    {
      name: 'Attendance leak',
      display: 'Show rate is the leak: too many booked leads don\'t show up.',
      condition: (a) => ['Under 40%', '40-59%'].includes(a.V4),
      scoreKey: 'V4',
    },
    {
      name: 'Follow-up leak',
      display: 'Follow-up is the leak: too many leads disappear after initial interest.',
      condition: (a) => [
        "Can't reach them / slow follow-up",
        'They ghost after the quote',
      ].includes(a.C3),
      scoreKey: 'C3',
    },
  ],

  [PILLARS.RETENTION]: [
    {
      name: 'No retention cadence',
      display: "Retention is accidental: there's no consistent account review cadence.",
      condition: (a) => ['Yearly', 'Rarely/Never'].includes(a.R1),
      scoreKey: 'R1',
    },
    {
      name: 'Low compounding',
      display: 'Compounding is weak: revenue relies mostly on new customers (or is split).',
      condition: (a) => [
        'Most revenue comes from new customers',
        'Roughly split between new and existing customers',
      ].includes(a.R3),
      scoreKey: 'R3',
    },
    {
      name: 'At-risk base',
      display: 'The base is at risk: revenue from existing clients is flat or shrinking.',
      condition: (a) => ['Flat', 'Shrunk'].includes(a.R2),
      scoreKey: 'R2',
    },
  ],
};

// ---------------------------------------------------------------------------
// Primary gap statement templates
// ---------------------------------------------------------------------------
const GAP_STATEMENTS = {
  [PILLARS.ACQUISITION]:
    'Your primary growth gap is **Acquisition** (getting enough qualified leads).',
  [PILLARS.CONVERSION]:
    'Your primary growth gap is **Conversion** (turning leads into booked work).',
  [PILLARS.RETENTION]:
    'Your primary growth gap is **Retention** (repeats, reviews, referrals, and expansion).',
};

// ---------------------------------------------------------------------------
// Cost-of-leak templates
// ---------------------------------------------------------------------------
const COST_OF_LEAK = {
  [PILLARS.ACQUISITION]: {
    text: 'Often 1-3 missed opportunities/month',
    advice: 'If demand is the bottleneck, small changes can unlock a steady flow of qualified leads.',
  },
  [PILLARS.CONVERSION]: {
    text: 'Often 10-30% of leads leak before booking',
    advice: 'Most conversion gains come from speed, ownership, and follow-up.',
  },
  [PILLARS.RETENTION]: {
    text: 'Often 10-25% revenue is trapped in churn/no-repeat',
    advice: 'Retention systems compound: repeats, reviews, and referrals.',
  },
};

// ---------------------------------------------------------------------------
// Fastest next-step templates
// ---------------------------------------------------------------------------
const FASTEST_NEXT_STEPS = {
  [PILLARS.ACQUISITION]: [
    'Add one additional reliable lead source (so you\'re not dependent on a single channel).',
    'Improve lead fit by tightening your offer + ideal customer definition.',
  ],
  [PILLARS.CONVERSION]: [
    "Set a first-response standard and assign one owner (so leads never 'float').",
    'Reduce time-to-meeting with a simple booking path and consistent follow-up.',
  ],
  [PILLARS.RETENTION]: [
    'Create a simple review cadence (monthly or quarterly) with a clear owner.',
    'Grow existing-customer revenue with a simple follow-up rhythm (and add a referral ask where it fits).',
  ],
};

// ---------------------------------------------------------------------------
// Key signal definitions (strongest = +2 answers)
// ---------------------------------------------------------------------------
const SIGNAL_DEFINITIONS = [
  { questionId: 'V3', label: (a) => `response time is ${a.V3}` },
  { questionId: 'V4', label: (a) => `show rate is ${a.V4}` },
  { questionId: 'V5', label: (a) => `most leads come from one source`, condition: (a) => a.V5 === 'Most leads come from one source' },
  { questionId: 'V5', label: (a) => `leads come from only two sources`, condition: (a) => a.V5 === 'Two sources' },
  { questionId: 'R3', label: (a) => `revenue relies mostly on new customers`, condition: (a) => a.R3 === 'Most revenue comes from new customers' },
  { questionId: 'R3', label: (a) => `revenue is roughly split between new and existing customers`, condition: (a) => a.R3 === 'Roughly split between new and existing customers' },
  { questionId: 'R1', label: (a) => `account reviews are ${a.R1?.toLowerCase() || 'infrequent'}` },
  { questionId: 'R2', label: (a) => `existing-client revenue has ${a.R2?.toLowerCase()}` },
  { questionId: 'V2', label: (a) => `lead volume is ${a.V2} per month` },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get the points a specific answer contributed for its question.
 */
function getPointsForAnswer(questionId, answer) {
  const rule = SCORING_RULES[questionId];
  if (!rule) return 0;

  if (rule.pillar === 'MIXED') {
    const route = rule.routes[answer];
    return route ? route.points : 0;
  }

  return rule.points[answer] ?? 0;
}

/**
 * Select the sub-diagnosis for a given primary gap.
 *
 * Priority: pick the sub whose triggering answer contributed the most points.
 * If tied on points, use the definition order (which matches the spec's priority order).
 */
function selectSubDiagnosis(primaryGap, answers) {
  const candidates = SUB_DIAGNOSES[primaryGap];
  if (!candidates) return null;

  const matches = candidates
    .filter((sub) => sub.condition(answers))
    .map((sub) => ({
      ...sub,
      contributedPoints: getPointsForAnswer(sub.scoreKey, answers[sub.scoreKey]),
    }));

  if (matches.length === 0) return null;

  // Sort by contributed points descending; definition order is preserved for ties
  // because Array.prototype.sort is stable in modern engines
  matches.sort((a, b) => b.contributedPoints - a.contributedPoints);

  return matches[0];
}

/**
 * Pick the top 1-2 key signals (answers that scored +2).
 */
function selectKeySignals(answers) {
  const signals = [];

  for (const def of SIGNAL_DEFINITIONS) {
    const answer = answers[def.questionId];
    if (!answer) continue;

    const pts = getPointsForAnswer(def.questionId, answer);
    if (pts < 2) continue; // only strongest signals

    // If the definition has a condition, check it
    if (def.condition && !def.condition(answers)) continue;

    signals.push(def.label(answers));
    if (signals.length >= 2) break;
  }

  return signals;
}

/**
 * Format the "Based on your answers" line.
 */
function formatSignalsLine(signals) {
  if (signals.length === 0) return '';
  if (signals.length === 1) return `Based on your answers: ${signals[0]}.`;
  return `Based on your answers: ${signals[0]}, and ${signals[1]}.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate all results content for the quiz results page.
 *
 * @param {object} scoringResult - Output from scoreQuiz()
 * @param {Record<string, string>} answers - Raw quiz answers
 * @returns {object} ResultsContent
 */
function generateResults(scoringResult, answers) {
  const { primaryGap } = scoringResult;

  const sub = selectSubDiagnosis(primaryGap, answers);
  const signals = selectKeySignals(answers);
  const leak = COST_OF_LEAK[primaryGap];

  return {
    primaryGapStatement: GAP_STATEMENTS[primaryGap],
    subDiagnosis: sub ? sub.name : null,
    subDiagnosisDisplay: sub ? sub.display : null,
    keySignals: signals,
    keySignalsLine: formatSignalsLine(signals),
    costOfLeak: leak.text,
    costOfLeakAdvice: leak.advice,
    fastestNextSteps: FASTEST_NEXT_STEPS[primaryGap],
  };
}

module.exports = {
  generateResults,
  // Exported for unit testing internals
  _internal: {
    selectSubDiagnosis,
    selectKeySignals,
    formatSignalsLine,
    getPointsForAnswer,
  },
  // Exported for other modules that need template data
  SUB_DIAGNOSES,
  GAP_STATEMENTS,
  COST_OF_LEAK,
  FASTEST_NEXT_STEPS,
};
