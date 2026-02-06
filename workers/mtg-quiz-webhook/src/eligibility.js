/**
 * MindtheGaps — Scan Eligibility Check
 *
 * Pure function that determines whether a quiz prospect qualifies for the
 * paid scan ($295 CAD). Takes scoring result + raw answers, returns eligibility
 * status and fix-first reason(s) if not eligible.
 *
 * Spec reference: PROJECT_CONTEXT.md Section 1.8
 *
 * Eligible if ALL conditions are met:
 *   1. Decision-maker will attend            (cannot infer from quiz — assumed true for MVP)
 *   2. Can share basic numbers               (checked: "Not sure" / missing count on data Qs)
 *   3. Has active demand or client base       (checked: V2 and/or R2 answered)
 *   4. Willing to focus on one lever          (always true — quiz determines the lever)
 *
 * Public API:
 *   checkEligibility(scoringResult, answers)  → EligibilityResult
 *
 * EligibilityResult shape:
 *   {
 *     eligible:          boolean,
 *     fixFirstReason:    string | null,   // primary reason (maps to mtg_fix_first_reason)
 *     fixFirstAdvice:    string | null,   // actionable fix for the primary reason
 *     allReasons:        Array<{ reason: string, advice: string }>,
 *   }
 */

// ---------------------------------------------------------------------------
// Data questions used for the "can share numbers" check.
// Excludes V1 (focus/tie-break), C1 (ownership — qualitative), C3 (situation).
// ---------------------------------------------------------------------------
const DATA_QUESTIONS = Object.freeze([
  'V2', 'V3', 'V4', 'V5', 'A1', 'C2', 'C4', 'R1', 'R2', 'R3',
]);

// ---------------------------------------------------------------------------
// Thresholds (easy for Marc/Tyler to tune later)
// ---------------------------------------------------------------------------

/** If >= this many data Qs are "Not sure" or missing, prospect can't share numbers. */
const NOT_SURE_THRESHOLD = 5;

/**
 * If baseline = 0 AND >= this many data Qs are "Not sure"/missing,
 * the prospect's offer/situation is too unclear for a useful scan.
 */
const CLARITY_NOT_SURE_THRESHOLD = 8;

// ---------------------------------------------------------------------------
// Fix-first reasons + advice (from spec Section 1.8)
// ---------------------------------------------------------------------------
const FIX_FIRST = Object.freeze({
  numbers: {
    reason: 'No basic numbers available',
    advice: 'Pull rough counts for the last 30 days before booking a scan.',
  },
  demand: {
    reason: 'No active demand to work with',
    advice: 'Run a simple reactivation push first, then revisit the scan.',
  },
  clarity: {
    reason: 'Offer/ideal customer is too unclear',
    advice: 'Define one core offer and who it\'s for before booking a scan.',
  },
  owner: {
    reason: 'No clear owner for growth changes',
    advice: 'Assign an owner for response/booking/follow-up before booking a scan.',
  },
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Count how many DATA_QUESTIONS have "Not sure" or missing (undefined/null) answers.
 */
function countNotSureOrMissing(answers) {
  return DATA_QUESTIONS.filter(
    (q) => answers[q] === undefined || answers[q] === null || answers[q] === 'Not sure',
  ).length;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine whether a quiz prospect qualifies for the paid scan.
 *
 * @param {object} scoringResult - Output from scoreQuiz()
 * @param {Record<string, string>} answers - Raw quiz answers
 * @returns {object} EligibilityResult
 */
function checkEligibility(scoringResult, answers) {
  if (!scoringResult || !answers || typeof answers !== 'object') {
    throw new Error('checkEligibility requires both scoringResult and answers');
  }

  const failedChecks = [];
  const notSureCount = countNotSureOrMissing(answers);

  // -----------------------------------------------------------------------
  // Check 1: Can share basic numbers
  //
  // If >= NOT_SURE_THRESHOLD data questions are "Not sure" or missing, the
  // prospect can't provide the rough estimates needed during the scan.
  // -----------------------------------------------------------------------
  if (notSureCount >= NOT_SURE_THRESHOLD) {
    failedChecks.push('numbers');
  }

  // -----------------------------------------------------------------------
  // Check 2: Has active demand or active client base
  //
  // V2 (lead volume) or R2 (client base change) being answered — even with
  // "Not sure" — means the prospect engaged with that metric. Both being
  // completely unanswered means we have zero evidence of business activity.
  // -----------------------------------------------------------------------
  const v2Answered = answers.V2 !== undefined && answers.V2 !== null;
  const r2Answered = answers.R2 !== undefined && answers.R2 !== null;
  if (!v2Answered && !r2Answered) {
    failedChecks.push('demand');
  }

  // -----------------------------------------------------------------------
  // Check 3: Offer / ideal customer clarity
  //
  // A baseline score of 0 means no meaningful scoring signals at all. If
  // ALSO most data questions are "Not sure"/missing, the prospect's
  // situation is too unclear for a productive scan.
  // -----------------------------------------------------------------------
  if (scoringResult.baselineScore === 0 && notSureCount >= CLARITY_NOT_SURE_THRESHOLD) {
    failedChecks.push('clarity');
  }

  // Build result
  const allReasons = failedChecks.map((id) => ({
    reason: FIX_FIRST[id].reason,
    advice: FIX_FIRST[id].advice,
  }));

  return {
    eligible: failedChecks.length === 0,
    fixFirstReason: allReasons.length > 0 ? allReasons[0].reason : null,
    fixFirstAdvice: allReasons.length > 0 ? allReasons[0].advice : null,
    allReasons,
  };
}

module.exports = {
  checkEligibility,
  // Exported for unit testing internals
  _internal: {
    countNotSureOrMissing,
    DATA_QUESTIONS,
    NOT_SURE_THRESHOLD,
    CLARITY_NOT_SURE_THRESHOLD,
    FIX_FIRST,
  },
};
