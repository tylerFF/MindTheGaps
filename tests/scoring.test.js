/**
 * MindtheGaps — Scoring Engine Tests
 *
 * Covers:
 *  - Point tallying (per-pillar accumulation)
 *  - C3 special routing (all 5 answers)
 *  - Max-possible calculation (varies by C3 answer)
 *  - Primary gap determination (clear winners)
 *  - Tie-break rules (all 4 levels + alphabetical fallback)
 *  - Baseline score formula
 *  - Edge cases (empty input, partial answers, invalid input)
 *  - Full integration via scoreQuiz()
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { scoreQuiz, _internal } = require('../workers/mtg-quiz-webhook/src/scoring');
const { PILLARS } = require('../workers/shared/constants');
const { fixtures, buildAnswers, NEUTRAL_ANSWERS } = require('./testCases');

const {
  tallyPoints,
  calculateMaxPossible,
  findHighestPillars,
  breakTie,
  computeBaselineScore,
} = _internal;

// ===================================================================
// Unit tests for internal helpers
// ===================================================================

describe('tallyPoints', () => {
  it('returns zero totals for all-neutral answers', () => {
    const { totals } = tallyPoints(NEUTRAL_ANSWERS);
    assert.equal(totals[PILLARS.ACQUISITION], 0);
    assert.equal(totals[PILLARS.CONVERSION], 0);
    assert.equal(totals[PILLARS.RETENTION], 0);
  });

  it('tallies +2 Acquisition points from V2="0-9"', () => {
    const answers = buildAnswers({ V2: '0-9' });
    const { totals } = tallyPoints(answers);
    assert.equal(totals[PILLARS.ACQUISITION], 2);
  });

  it('tallies +1 Conversion points from V3="1-2 days"', () => {
    const answers = buildAnswers({ V3: '1-2 days' });
    const { totals } = tallyPoints(answers);
    assert.equal(totals[PILLARS.CONVERSION], 1);
  });

  it('does not add V1 to any pillar (non-scoring)', () => {
    const answers = buildAnswers({ V1: 'Getting more leads (Acquisition)' });
    const { totals } = tallyPoints(answers);
    assert.equal(totals[PILLARS.ACQUISITION], 0);
    assert.equal(totals[PILLARS.CONVERSION], 0);
    assert.equal(totals[PILLARS.RETENTION], 0);
  });

  it('handles missing answer keys gracefully (treats as 0)', () => {
    const { totals } = tallyPoints({});
    assert.equal(totals[PILLARS.ACQUISITION], 0);
    assert.equal(totals[PILLARS.CONVERSION], 0);
    assert.equal(totals[PILLARS.RETENTION], 0);
  });
});

describe('tallyPoints — C3 routing', () => {
  it('routes "Can\'t reach them / slow follow-up" → +2 Conversion', () => {
    const answers = buildAnswers({ C3: "Can't reach them / slow follow-up" });
    const { totals, c3Route } = tallyPoints(answers);
    assert.equal(totals[PILLARS.CONVERSION], 2);
    assert.equal(c3Route.pillar, PILLARS.CONVERSION);
    assert.equal(c3Route.points, 2);
    assert.equal(c3Route.tag, 'speed/follow-up');
  });

  it('routes "They ghost after the quote" → +2 Conversion', () => {
    const answers = buildAnswers({ C3: 'They ghost after the quote' });
    const { totals, c3Route } = tallyPoints(answers);
    assert.equal(totals[PILLARS.CONVERSION], 2);
    assert.equal(c3Route.pillar, PILLARS.CONVERSION);
    assert.equal(c3Route.points, 2);
    assert.equal(c3Route.tag, 'follow-up');
  });

  it('routes "Price objections" → +1 Conversion', () => {
    const answers = buildAnswers({ C3: 'Price objections' });
    const { totals, c3Route } = tallyPoints(answers);
    assert.equal(totals[PILLARS.CONVERSION], 1);
    assert.equal(c3Route.points, 1);
    assert.equal(c3Route.tag, 'offer clarity');
  });

  it('routes "Not the right fit" → +1 Acquisition', () => {
    const answers = buildAnswers({ C3: 'Not the right fit' });
    const { totals, c3Route } = tallyPoints(answers);
    assert.equal(totals[PILLARS.ACQUISITION], 1);
    assert.equal(c3Route.pillar, PILLARS.ACQUISITION);
    assert.equal(c3Route.points, 1);
    assert.equal(c3Route.tag, 'targeting');
  });

  it('routes "Not sure" → 0 points, no pillar', () => {
    const answers = buildAnswers({ C3: 'Not sure' });
    const { totals, c3Route } = tallyPoints(answers);
    assert.equal(totals[PILLARS.ACQUISITION], 0);
    assert.equal(totals[PILLARS.CONVERSION], 0);
    assert.equal(c3Route.pillar, null);
    assert.equal(c3Route.points, 0);
  });
});

describe('calculateMaxPossible', () => {
  it('returns base maxes when C3 has no pillar', () => {
    const maxes = calculateMaxPossible({ pillar: null, points: 0, tag: null });
    assert.equal(maxes[PILLARS.ACQUISITION], 6);
    assert.equal(maxes[PILLARS.CONVERSION], 10);
    assert.equal(maxes[PILLARS.RETENTION], 6);
  });

  it('adds +2 to Conversion max when C3 routes to Conversion with 2 pts', () => {
    const maxes = calculateMaxPossible({ pillar: PILLARS.CONVERSION, points: 2, tag: 'speed/follow-up' });
    assert.equal(maxes[PILLARS.CONVERSION], 12);
    assert.equal(maxes[PILLARS.ACQUISITION], 6); // unchanged
  });

  it('adds +1 to Conversion max when C3 = "Price objections"', () => {
    const maxes = calculateMaxPossible({ pillar: PILLARS.CONVERSION, points: 1, tag: 'offer clarity' });
    assert.equal(maxes[PILLARS.CONVERSION], 11);
  });

  it('adds +1 to Acquisition max when C3 = "Not the right fit"', () => {
    const maxes = calculateMaxPossible({ pillar: PILLARS.ACQUISITION, points: 1, tag: 'targeting' });
    assert.equal(maxes[PILLARS.ACQUISITION], 7);
  });
});

describe('findHighestPillars', () => {
  it('returns single winner when one pillar is highest', () => {
    const result = findHighestPillars({ Acquisition: 5, Conversion: 3, Retention: 1 });
    assert.deepEqual(result, ['Acquisition']);
  });

  it('returns two pillars in a two-way tie', () => {
    const result = findHighestPillars({ Acquisition: 4, Conversion: 4, Retention: 1 });
    assert.equal(result.length, 2);
    assert.ok(result.includes('Acquisition'));
    assert.ok(result.includes('Conversion'));
  });

  it('returns all three in a three-way tie', () => {
    const result = findHighestPillars({ Acquisition: 0, Conversion: 0, Retention: 0 });
    assert.equal(result.length, 3);
  });
});

describe('breakTie', () => {
  it('rule 1: Conversion wins when V3 is in slow-response set', () => {
    const answers = buildAnswers({ V3: '3+ days' });
    const { winner, rule } = breakTie([PILLARS.CONVERSION, PILLARS.ACQUISITION], answers);
    assert.equal(winner, PILLARS.CONVERSION);
    assert.equal(rule, 'conversion_signal');
  });

  it('rule 1: Conversion wins when V4 is in low-show set', () => {
    const answers = buildAnswers({ V4: 'Under 40%' });
    const { winner, rule } = breakTie([PILLARS.CONVERSION, PILLARS.RETENTION], answers);
    assert.equal(winner, PILLARS.CONVERSION);
    assert.equal(rule, 'conversion_signal');
  });

  it('rule 2: Acquisition wins when BOTH V2 and V5 signal (Conv not tied or Conv signal absent)', () => {
    const answers = buildAnswers({ V2: '0-9', V5: 'Most leads come from one source' });
    const { winner, rule } = breakTie([PILLARS.ACQUISITION, PILLARS.RETENTION], answers);
    assert.equal(winner, PILLARS.ACQUISITION);
    assert.equal(rule, 'acquisition_signal');
  });

  it('rule 2: Acquisition does NOT win if only V2 signals (V5 neutral)', () => {
    const answers = buildAnswers({ V2: '0-9', V5: 'Three or more sources' });
    // Acq and Ret tied, Conv not in tie. Acq signal needs BOTH V2+V5.
    // V5 not in set → Acq signal fails. Ret signal needs R1+R3.
    // R1 = Monthly (not in set) → Ret signal fails. Falls to V1.
    const { winner, rule } = breakTie([PILLARS.ACQUISITION, PILLARS.RETENTION], answers);
    // V1 = "Not sure" → alphabetical among tied → Acquisition
    assert.equal(rule, 'alphabetical_fallback');
  });

  it('rule 3: Retention wins when BOTH R1 and R3 signal', () => {
    const answers = buildAnswers({
      R1: 'Rarely/Never',
      R3: 'Most revenue comes from new customers',
    });
    const { winner, rule } = breakTie([PILLARS.ACQUISITION, PILLARS.RETENTION], answers);
    assert.equal(winner, PILLARS.RETENTION);
    assert.equal(rule, 'retention_signal');
  });

  it('rule 4: V1 answer breaks tie when no signal rules fire', () => {
    const answers = buildAnswers({ V1: 'Getting repeats/referrals (Retention)' });
    const { winner, rule } = breakTie(
      [PILLARS.ACQUISITION, PILLARS.CONVERSION, PILLARS.RETENTION],
      answers,
    );
    assert.equal(winner, PILLARS.RETENTION);
    assert.equal(rule, 'v1_answer');
  });

  it('rule 4 fallback: V1 = "Not sure" → first alphabetically', () => {
    const answers = buildAnswers({ V1: 'Not sure' });
    const { winner, rule } = breakTie(
      [PILLARS.ACQUISITION, PILLARS.CONVERSION, PILLARS.RETENTION],
      answers,
    );
    assert.equal(winner, PILLARS.ACQUISITION);
    assert.equal(rule, 'alphabetical_fallback');
  });

  it('rule 1 takes priority over rule 2 when both could fire', () => {
    // Both Conv and Acq signals could fire, but Conv is checked first
    const answers = buildAnswers({
      V3: '3+ days',       // Conv signal
      V2: '0-9',           // Acq signal part 1
      V5: 'Two sources',   // Acq signal part 2
    });
    const { winner, rule } = breakTie(
      [PILLARS.CONVERSION, PILLARS.ACQUISITION],
      answers,
    );
    assert.equal(winner, PILLARS.CONVERSION);
    assert.equal(rule, 'conversion_signal');
  });
});

describe('computeBaselineScore', () => {
  it('returns 100 when gap total equals max', () => {
    assert.equal(computeBaselineScore(6, 6), 100);
  });

  it('returns 0 when gap total is 0', () => {
    assert.equal(computeBaselineScore(0, 6), 0);
  });

  it('rounds correctly (100 * 2/6 = 33.33 → 33)', () => {
    assert.equal(computeBaselineScore(2, 6), 33);
  });

  it('rounds correctly (100 * 7/12 = 58.33 → 58)', () => {
    assert.equal(computeBaselineScore(7, 12), 58);
  });

  it('rounds correctly (100 * 5/12 = 41.67 → 42)', () => {
    assert.equal(computeBaselineScore(5, 12), 42);
  });

  it('returns 0 when max is 0 (safety)', () => {
    assert.equal(computeBaselineScore(0, 0), 0);
  });
});

// ===================================================================
// Integration tests via scoreQuiz()
// ===================================================================

describe('scoreQuiz — clear winners', () => {
  const clearWinFixtures = [
    fixtures.CLEAR_ACQUISITION,
    fixtures.CLEAR_CONVERSION,
    fixtures.CLEAR_RETENTION,
  ];

  for (const fixture of clearWinFixtures) {
    it(fixture.name, () => {
      const result = scoreQuiz(fixture.answers);
      assert.equal(result.primaryGap, fixture.expected.primaryGap);
      assert.deepEqual(result.pillarTotals, fixture.expected.pillarTotals);
      assert.equal(result.baselineScore, fixture.expected.baselineScore);
      assert.equal(result.tieBreakUsed, fixture.expected.tieBreakUsed);
      if (fixture.expected.c3Route) {
        assert.deepEqual(result.c3Route, fixture.expected.c3Route);
      }
    });
  }
});

describe('scoreQuiz — tie-break scenarios', () => {
  const tieFixtures = [
    fixtures.TIE_CONV_VS_ACQ_CONV_WINS,
    fixtures.TIE_ACQ_VS_RET_ACQ_WINS,
    fixtures.THREE_WAY_TIE_V1_RETENTION,
    fixtures.THREE_WAY_TIE_ALPHABETICAL,
    fixtures.TIE_RET_WINS_VIA_SIGNAL,
  ];

  for (const fixture of tieFixtures) {
    it(fixture.name, () => {
      const result = scoreQuiz(fixture.answers);
      assert.equal(result.primaryGap, fixture.expected.primaryGap);
      assert.deepEqual(result.pillarTotals, fixture.expected.pillarTotals);
      assert.equal(result.baselineScore, fixture.expected.baselineScore);
      assert.equal(result.tieBreakUsed, fixture.expected.tieBreakUsed);
    });
  }
});

describe('scoreQuiz — C3 routing', () => {
  it(fixtures.C3_PRICE_OBJECTIONS.name, () => {
    const result = scoreQuiz(fixtures.C3_PRICE_OBJECTIONS.answers);
    assert.equal(result.primaryGap, fixtures.C3_PRICE_OBJECTIONS.expected.primaryGap);
    assert.deepEqual(result.c3Route, fixtures.C3_PRICE_OBJECTIONS.expected.c3Route);
    assert.equal(result.baselineScore, fixtures.C3_PRICE_OBJECTIONS.expected.baselineScore);
  });

  it(fixtures.C3_NOT_RIGHT_FIT.name, () => {
    const result = scoreQuiz(fixtures.C3_NOT_RIGHT_FIT.answers);
    assert.equal(result.primaryGap, fixtures.C3_NOT_RIGHT_FIT.expected.primaryGap);
    assert.deepEqual(result.c3Route, fixtures.C3_NOT_RIGHT_FIT.expected.c3Route);
    assert.equal(result.baselineScore, fixtures.C3_NOT_RIGHT_FIT.expected.baselineScore);
  });
});

describe('scoreQuiz — mixed and edge cases', () => {
  it(fixtures.MIXED_CONV_WINS.name, () => {
    const result = scoreQuiz(fixtures.MIXED_CONV_WINS.answers);
    assert.equal(result.primaryGap, fixtures.MIXED_CONV_WINS.expected.primaryGap);
    assert.deepEqual(result.pillarTotals, fixtures.MIXED_CONV_WINS.expected.pillarTotals);
    assert.equal(result.baselineScore, fixtures.MIXED_CONV_WINS.expected.baselineScore);
    assert.deepEqual(result.c3Route, fixtures.MIXED_CONV_WINS.expected.c3Route);
  });

  it(fixtures.PARTIAL_ANSWERS.name, () => {
    const result = scoreQuiz(fixtures.PARTIAL_ANSWERS.answers);
    assert.equal(result.primaryGap, fixtures.PARTIAL_ANSWERS.expected.primaryGap);
    assert.deepEqual(result.pillarTotals, fixtures.PARTIAL_ANSWERS.expected.pillarTotals);
    assert.equal(result.baselineScore, fixtures.PARTIAL_ANSWERS.expected.baselineScore);
    assert.deepEqual(result.c3Route, fixtures.PARTIAL_ANSWERS.expected.c3Route);
  });

  it('throws on null input', () => {
    assert.throws(() => scoreQuiz(null), /expects an answers object/);
  });

  it('throws on undefined input', () => {
    assert.throws(() => scoreQuiz(undefined), /expects an answers object/);
  });

  it('throws on non-object input', () => {
    assert.throws(() => scoreQuiz('bad'), /expects an answers object/);
  });

  it('handles empty object (all zeros, alphabetical fallback)', () => {
    const result = scoreQuiz({});
    assert.equal(result.primaryGap, PILLARS.ACQUISITION); // alphabetical
    assert.equal(result.baselineScore, 0);
  });
});

describe('scoreQuiz — max possible is correct per C3 answer', () => {
  it('C3 neutral → Acq=6, Conv=10, Ret=6', () => {
    const result = scoreQuiz(buildAnswers({ C3: 'Not sure' }));
    assert.equal(result.maxPossible[PILLARS.ACQUISITION], 6);
    assert.equal(result.maxPossible[PILLARS.CONVERSION], 10);
    assert.equal(result.maxPossible[PILLARS.RETENTION], 6);
  });

  it('C3 ghost → Conv max = 12', () => {
    const result = scoreQuiz(buildAnswers({ C3: 'They ghost after the quote' }));
    assert.equal(result.maxPossible[PILLARS.CONVERSION], 12);
  });

  it('C3 price → Conv max = 11', () => {
    const result = scoreQuiz(buildAnswers({ C3: 'Price objections' }));
    assert.equal(result.maxPossible[PILLARS.CONVERSION], 11);
  });

  it('C3 not right fit → Acq max = 7', () => {
    const result = scoreQuiz(buildAnswers({ C3: 'Not the right fit' }));
    assert.equal(result.maxPossible[PILLARS.ACQUISITION], 7);
  });
});
