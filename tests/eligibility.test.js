/**
 * MindtheGaps — Eligibility Check Tests
 *
 * Covers:
 *  - countNotSureOrMissing helper
 *  - "No basic numbers available" check (Not-sure / missing threshold)
 *  - "No active demand" check (V2 + R2 both missing)
 *  - "Offer too unclear" check (baseline 0 + high Not-sure count)
 *  - Full integration via checkEligibility()
 *  - Edge cases (thresholds, partial answers, empty answers)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { scoreQuiz } = require('../workers/mtg-quiz-webhook/src/scoring');
const { checkEligibility, _internal } = require('../workers/mtg-quiz-webhook/src/eligibility');
const { fixtures, buildAnswers } = require('./testCases');

const {
  countNotSureOrMissing,
  DATA_QUESTIONS,
  NOT_SURE_THRESHOLD,
  CLARITY_NOT_SURE_THRESHOLD,
} = _internal;

// ===================================================================
// countNotSureOrMissing
// ===================================================================

describe('countNotSureOrMissing', () => {
  it('returns 0 for neutral answers (all data questions have real values)', () => {
    const answers = buildAnswers({});
    assert.equal(countNotSureOrMissing(answers), 0);
  });

  it('counts "Not sure" answers on data questions', () => {
    const answers = buildAnswers({ V2: 'Not sure', V3: 'Not sure', V4: 'Not sure' });
    assert.equal(countNotSureOrMissing(answers), 3);
  });

  it('counts missing (undefined) answers on data questions', () => {
    // Only V2 provided — 9 of 10 data questions are missing
    assert.equal(countNotSureOrMissing({ V2: '0-9' }), 9);
  });

  it('does NOT count V1 (not a data question)', () => {
    const answers = buildAnswers({ V1: 'Not sure' });
    assert.equal(countNotSureOrMissing(answers), 0);
  });

  it('does NOT count C1 or C3 (not data questions)', () => {
    const answers = buildAnswers({ C1: 'Not sure', C3: 'Not sure' });
    assert.equal(countNotSureOrMissing(answers), 0);
  });

  it('returns 10 for completely empty answers', () => {
    assert.equal(countNotSureOrMissing({}), 10);
  });
});

// ===================================================================
// Check: Can share basic numbers
// ===================================================================

describe('numbers check — "Not sure" threshold', () => {
  it('eligible when 0 "Not sure" (all real values)', () => {
    const answers = buildAnswers({});
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    assert.equal(result.eligible, true);
  });

  it('eligible when exactly 4 "Not sure" (just below threshold)', () => {
    const answers = buildAnswers({
      V2: 'Not sure',
      V3: 'Not sure',
      V4: 'Not sure',
      V5: 'Not sure',
    });
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    assert.equal(result.eligible, true);
    assert.equal(result.fixFirstReason, null);
  });

  it('NOT eligible when exactly 5 "Not sure" (at threshold)', () => {
    const answers = buildAnswers({
      V2: 'Not sure',
      V3: 'Not sure',
      V4: 'Not sure',
      V5: 'Not sure',
      A1: 'Not sure',
    });
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    assert.equal(result.eligible, false);
    assert.equal(result.fixFirstReason, 'No basic numbers available');
  });

  it('NOT eligible when all 10 data questions are "Not sure"', () => {
    const answers = buildAnswers({
      V2: 'Not sure', V3: 'Not sure', V4: 'Not sure', V5: 'Not sure',
      A1: 'Not sure', C2: 'Not sure', C4: 'Not sure',
      R1: 'Not sure', R2: 'Not sure', R3: 'Not sure',
    });
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    assert.equal(result.eligible, false);
    assert.ok(result.allReasons.some((r) => r.reason === 'No basic numbers available'));
  });
});

// ===================================================================
// Check: Active demand / client base
// ===================================================================

describe('demand check — V2 and R2 presence', () => {
  it('eligible when both V2 and R2 are answered', () => {
    const answers = buildAnswers({}); // neutral has V2 and R2
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    assert.equal(result.eligible, true);
  });

  it('eligible when V2 answered but R2 missing', () => {
    // V2 present, R2 absent — still has lead flow evidence
    const answers = { V2: '0-9' };
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    // May fail numbers check (9 missing), but NOT demand check
    const demandFailed = result.allReasons.some((r) => r.reason === 'No active demand to work with');
    assert.equal(demandFailed, false);
  });

  it('eligible when R2 answered but V2 missing', () => {
    // R2 present, V2 absent — has client base evidence
    const answers = { R2: 'Grown' };
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    const demandFailed = result.allReasons.some((r) => r.reason === 'No active demand to work with');
    assert.equal(demandFailed, false);
  });

  it('eligible when V2 = "Not sure" (they engaged even if uncertain)', () => {
    const answers = { V2: 'Not sure' };
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    const demandFailed = result.allReasons.some((r) => r.reason === 'No active demand to work with');
    assert.equal(demandFailed, false);
  });

  it('NOT eligible when both V2 and R2 are missing', () => {
    // Only V1 provided — no evidence of business activity
    const answers = { V1: 'Not sure' };
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    assert.ok(result.allReasons.some((r) => r.reason === 'No active demand to work with'));
  });

  it('NOT eligible when answers are completely empty', () => {
    const answers = {};
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    assert.ok(result.allReasons.some((r) => r.reason === 'No active demand to work with'));
  });
});

// ===================================================================
// Check: Offer / ideal customer clarity
// ===================================================================

describe('clarity check — baseline 0 + high Not-sure count', () => {
  it('eligible with baseline 0 but few "Not sure" (neutral answers)', () => {
    // Neutral answers: baseline = 0, but notSureCount = 0 → clarity passes
    const answers = buildAnswers({});
    const scoring = scoreQuiz(answers);
    assert.equal(scoring.baselineScore, 0); // confirm baseline is 0
    const result = checkEligibility(scoring, answers);
    assert.equal(result.eligible, true);
  });

  it('eligible with high "Not sure" count but baseline > 0', () => {
    // V2 = "0-9" (+2 Acq) → baseline > 0, even with 5 "Not sure"
    const answers = buildAnswers({
      V2: '0-9',
      V3: 'Not sure', V4: 'Not sure', V5: 'Not sure',
      A1: 'Not sure', C2: 'Not sure', C4: 'Not sure',
      R1: 'Not sure', R2: 'Not sure',
    });
    const scoring = scoreQuiz(answers);
    assert.ok(scoring.baselineScore > 0);
    const result = checkEligibility(scoring, answers);
    // Numbers check will fail (8 Not sure), but clarity should NOT
    const clarityFailed = result.allReasons.some(
      (r) => r.reason === 'Offer/ideal customer is too unclear',
    );
    assert.equal(clarityFailed, false);
  });

  it('NOT eligible when baseline = 0 AND >= 8 data Qs are Not-sure/missing', () => {
    // All data questions "Not sure" → baseline = 0, notSureCount = 10
    const answers = buildAnswers({
      V2: 'Not sure', V3: 'Not sure', V4: 'Not sure', V5: 'Not sure',
      A1: 'Not sure', C2: 'Not sure', C4: 'Not sure',
      R1: 'Not sure', R2: 'Not sure', R3: 'Not sure',
    });
    const scoring = scoreQuiz(answers);
    assert.equal(scoring.baselineScore, 0);
    const result = checkEligibility(scoring, answers);
    assert.ok(result.allReasons.some(
      (r) => r.reason === 'Offer/ideal customer is too unclear',
    ));
  });

  it('eligible when baseline = 0 AND exactly 7 Not-sure (below clarity threshold)', () => {
    const answers = buildAnswers({
      V2: 'Not sure', V3: 'Not sure', V4: 'Not sure', V5: 'Not sure',
      A1: 'Not sure', C2: 'Not sure', C4: 'Not sure',
      // R1, R2, R3 have real values → 7 Not sure
    });
    const scoring = scoreQuiz(answers);
    const result = checkEligibility(scoring, answers);
    const clarityFailed = result.allReasons.some(
      (r) => r.reason === 'Offer/ideal customer is too unclear',
    );
    assert.equal(clarityFailed, false);
  });
});

// ===================================================================
// Full integration via checkEligibility()
// ===================================================================

describe('checkEligibility — integration with existing fixtures', () => {
  it('CLEAR_ACQUISITION is eligible', () => {
    const f = fixtures.CLEAR_ACQUISITION;
    const scoring = scoreQuiz(f.answers);
    const result = checkEligibility(scoring, f.answers);
    assert.equal(result.eligible, true);
    assert.equal(result.fixFirstReason, null);
    assert.equal(result.fixFirstAdvice, null);
    assert.equal(result.allReasons.length, 0);
  });

  it('CLEAR_CONVERSION is eligible', () => {
    const f = fixtures.CLEAR_CONVERSION;
    const scoring = scoreQuiz(f.answers);
    const result = checkEligibility(scoring, f.answers);
    assert.equal(result.eligible, true);
  });

  it('CLEAR_RETENTION is eligible', () => {
    const f = fixtures.CLEAR_RETENTION;
    const scoring = scoreQuiz(f.answers);
    const result = checkEligibility(scoring, f.answers);
    assert.equal(result.eligible, true);
  });

  it('MIXED_CONV_WINS is eligible', () => {
    const f = fixtures.MIXED_CONV_WINS;
    const scoring = scoreQuiz(f.answers);
    const result = checkEligibility(scoring, f.answers);
    assert.equal(result.eligible, true);
  });

  it('THREE_WAY_TIE_V1_RETENTION is eligible (neutral answers, all real values)', () => {
    const f = fixtures.THREE_WAY_TIE_V1_RETENTION;
    const scoring = scoreQuiz(f.answers);
    const result = checkEligibility(scoring, f.answers);
    assert.equal(result.eligible, true);
  });

  it('PARTIAL_ANSWERS is NOT eligible (only V2 provided → 9 missing)', () => {
    const f = fixtures.PARTIAL_ANSWERS;
    const scoring = scoreQuiz(f.answers);
    const result = checkEligibility(scoring, f.answers);
    assert.equal(result.eligible, false);
    assert.equal(result.fixFirstReason, 'No basic numbers available');
  });
});

// ===================================================================
// Edge cases
// ===================================================================

describe('checkEligibility — edge cases', () => {
  it('throws on missing scoringResult', () => {
    assert.throws(
      () => checkEligibility(null, buildAnswers({})),
      { message: /requires both/ },
    );
  });

  it('throws on missing answers', () => {
    const scoring = scoreQuiz(buildAnswers({}));
    assert.throws(
      () => checkEligibility(scoring, null),
      { message: /requires both/ },
    );
  });

  it('empty answers object triggers all relevant checks', () => {
    const scoring = scoreQuiz({});
    const result = checkEligibility(scoring, {});
    assert.equal(result.eligible, false);
    // Should have at least numbers + demand + clarity
    assert.ok(result.allReasons.length >= 3);
    assert.ok(result.allReasons.some((r) => r.reason === 'No basic numbers available'));
    assert.ok(result.allReasons.some((r) => r.reason === 'No active demand to work with'));
    assert.ok(result.allReasons.some((r) => r.reason === 'Offer/ideal customer is too unclear'));
  });

  it('returns primary reason as first failed check', () => {
    const scoring = scoreQuiz({});
    const result = checkEligibility(scoring, {});
    // Numbers check runs first → primary reason
    assert.equal(result.fixFirstReason, 'No basic numbers available');
    assert.ok(result.fixFirstAdvice.includes('30 days'));
  });

  it('allReasons contains matching advice for each reason', () => {
    const scoring = scoreQuiz({});
    const result = checkEligibility(scoring, {});
    for (const entry of result.allReasons) {
      assert.ok(entry.reason.length > 0);
      assert.ok(entry.advice.length > 0);
    }
  });
});
