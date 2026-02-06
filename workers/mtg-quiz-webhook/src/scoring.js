/**
 * MindtheGaps — Quiz Scoring Engine
 *
 * Pure functions with zero side-effects. Receives a map of
 * { questionId: answerText } and returns the full scoring result.
 *
 * Public API:
 *   scoreQuiz(answers)  → ScoringResult
 *
 * ScoringResult shape:
 *   {
 *     pillarTotals:   { Acquisition: number, Conversion: number, Retention: number },
 *     primaryGap:     string,        // one of PILLARS values
 *     baselineScore:  number,        // 0-100 (rounded integer)
 *     tieBreakUsed:   string | null, // description of which rule broke the tie, or null
 *     c3Route:        { pillar: string|null, points: number, tag: string|null },
 *     maxPossible:    { Acquisition: number, Conversion: number, Retention: number },
 *   }
 */

const {
  PILLARS,
  SCORING_RULES,
  V1_TIEBREAK_MAP,
  TIEBREAK_SIGNALS,
} = require('../../shared/constants');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Tally points per pillar from the provided answers.
 *
 * @param {Record<string, string>} answers - { questionId: answerText }
 * @returns {{ totals: Record<string, number>, c3Route: object }}
 */
function tallyPoints(answers) {
  const totals = {
    [PILLARS.ACQUISITION]: 0,
    [PILLARS.CONVERSION]: 0,
    [PILLARS.RETENTION]: 0,
  };

  let c3Route = { pillar: null, points: 0, tag: null };

  for (const [questionId, rule] of Object.entries(SCORING_RULES)) {
    const answer = answers[questionId];
    if (answer === undefined || answer === null) continue;

    if (rule.pillar === null) {
      // V1: non-scoring — skip tallying
      continue;
    }

    if (rule.pillar === 'MIXED') {
      // C3: route by answer
      const route = rule.routes[answer];
      if (route && route.pillar) {
        totals[route.pillar] += route.points;
        c3Route = { ...route };
      }
      continue;
    }

    // Standard question
    const pts = rule.points[answer] ?? 0;
    totals[rule.pillar] += pts;
  }

  return { totals, c3Route };
}

/**
 * Calculate the theoretical max points per pillar given the C3 answer.
 *
 * @param {object} c3Route - The resolved C3 route object
 * @returns {Record<string, number>}
 */
function calculateMaxPossible(c3Route) {
  // Base maximums (without C3 contribution)
  // Acquisition: V2(2) + V5(2) + A1(2) = 6
  // Conversion:  V3(2) + V4(2) + C1(2) + C2(2) + C4(2) = 10
  // Retention:   R1(2) + R2(2) + R3(2) = 6
  const maxes = {
    [PILLARS.ACQUISITION]: 6,
    [PILLARS.CONVERSION]: 10,
    [PILLARS.RETENTION]: 6,
  };

  // Add C3's contribution to whichever pillar it routed to
  if (c3Route.pillar) {
    maxes[c3Route.pillar] += c3Route.points;
  }

  return maxes;
}

/**
 * Find the pillar(s) with the highest total score.
 *
 * @param {Record<string, number>} totals
 * @returns {string[]} Array of pillar names tied for the highest score
 */
function findHighestPillars(totals) {
  const maxScore = Math.max(...Object.values(totals));
  return Object.keys(totals).filter((p) => totals[p] === maxScore);
}

/**
 * Apply tie-break rules in order to resolve a multi-way tie.
 *
 * Returns { winner: string, rule: string }.
 *
 * @param {string[]} tied   - Pillar names that are tied
 * @param {Record<string, string>} answers - Raw quiz answers
 * @returns {{ winner: string, rule: string }}
 */
function breakTie(tied, answers) {
  const tiedSet = new Set(tied);

  // Rule 1: Conversion wins if response time OR show rate signals are present
  if (tiedSet.has(PILLARS.CONVERSION)) {
    const convSignals = TIEBREAK_SIGNALS[PILLARS.CONVERSION];
    const v3Hit = convSignals.V3.includes(answers.V3);
    const v4Hit = convSignals.V4.includes(answers.V4);
    if (v3Hit || v4Hit) {
      return { winner: PILLARS.CONVERSION, rule: 'conversion_signal' };
    }
  }

  // Rule 2: Acquisition wins if BOTH lead volume AND source dependence signals hit
  if (tiedSet.has(PILLARS.ACQUISITION)) {
    const acqSignals = TIEBREAK_SIGNALS[PILLARS.ACQUISITION];
    const v2Hit = acqSignals.V2.includes(answers.V2);
    const v5Hit = acqSignals.V5.includes(answers.V5);
    if (v2Hit && v5Hit) {
      return { winner: PILLARS.ACQUISITION, rule: 'acquisition_signal' };
    }
  }

  // Rule 3: Retention wins if BOTH review cadence AND revenue mix signals hit
  if (tiedSet.has(PILLARS.RETENTION)) {
    const retSignals = TIEBREAK_SIGNALS[PILLARS.RETENTION];
    const r1Hit = retSignals.R1.includes(answers.R1);
    const r3Hit = retSignals.R3.includes(answers.R3);
    if (r1Hit && r3Hit) {
      return { winner: PILLARS.RETENTION, rule: 'retention_signal' };
    }
  }

  // Rule 4: V1 answer as final tie-break
  const v1Answer = answers.V1;
  const v1Pillar = V1_TIEBREAK_MAP[v1Answer];
  if (v1Pillar && tiedSet.has(v1Pillar)) {
    return { winner: v1Pillar, rule: 'v1_answer' };
  }

  // Rule 4 fallback: "Not sure" or unrecognized V1 → first alphabetically among tied
  const sorted = [...tied].sort();
  return { winner: sorted[0], rule: 'alphabetical_fallback' };
}

/**
 * Compute the baseline score for the winning gap.
 *
 * Formula (locked by client):
 *   baseline_score = ROUND(100 × (winning_gap_total / max_possible_for_that_gap), 0)
 *
 * @param {number} gapTotal
 * @param {number} gapMax
 * @returns {number}
 */
function computeBaselineScore(gapTotal, gapMax) {
  if (gapMax === 0) return 0;
  return Math.round(100 * (gapTotal / gapMax));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a complete quiz submission.
 *
 * @param {Record<string, string>} answers
 *   Map of question ID → answer text, e.g. { V1: "Getting more leads (Acquisition)", V2: "0-9", ... }
 *   Missing keys are treated as unanswered (0 points).
 *
 * @returns {object} ScoringResult (see module docblock for shape)
 */
function scoreQuiz(answers) {
  if (!answers || typeof answers !== 'object') {
    throw new Error('scoreQuiz expects an answers object');
  }

  const { totals, c3Route } = tallyPoints(answers);
  const maxPossible = calculateMaxPossible(c3Route);
  const highest = findHighestPillars(totals);

  let primaryGap;
  let tieBreakUsed = null;

  if (highest.length === 1) {
    primaryGap = highest[0];
  } else {
    const result = breakTie(highest, answers);
    primaryGap = result.winner;
    tieBreakUsed = result.rule;
  }

  const baselineScore = computeBaselineScore(
    totals[primaryGap],
    maxPossible[primaryGap],
  );

  return {
    pillarTotals: { ...totals },
    primaryGap,
    baselineScore,
    tieBreakUsed,
    c3Route,
    maxPossible: { ...maxPossible },
  };
}

module.exports = {
  scoreQuiz,
  // Exported for unit testing internals
  _internal: {
    tallyPoints,
    calculateMaxPossible,
    findHighestPillars,
    breakTie,
    computeBaselineScore,
  },
};
