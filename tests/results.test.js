/**
 * MindtheGaps — Results Content Generator Tests
 *
 * Covers:
 *  - Sub-diagnosis selection (per pillar, priority ordering, ties)
 *  - Key signal selection (strongest signals only)
 *  - Signal line formatting
 *  - Cost-of-leak and next-step template selection
 *  - Full integration via generateResults()
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { scoreQuiz } = require('../workers/mtg-quiz-webhook/src/scoring');
const { generateResults, _internal, SUB_DIAGNOSES, FASTEST_NEXT_STEPS, FASTEST_NEXT_STEPS_FALLBACK } = require('../workers/mtg-quiz-webhook/src/results');
const { PILLARS } = require('../workers/shared/constants');
const { fixtures, buildAnswers } = require('./testCases');

const { selectSubDiagnosis, selectKeySignals, formatSignalsLine } = _internal;

// ===================================================================
// Sub-diagnosis selection
// ===================================================================

describe('selectSubDiagnosis — Acquisition', () => {
  it('selects "Demand shortfall" when V2 = "0-9" (+2 pts, highest)', () => {
    const answers = buildAnswers({ V2: '0-9', V5: 'Two sources', A1: '6-10' });
    const sub = selectSubDiagnosis(PILLARS.ACQUISITION, answers);
    assert.equal(sub.name, 'Demand shortfall');
  });

  it('selects "Channel concentration risk" when V5 = "Most leads..." (+2 pts, highest)', () => {
    const answers = buildAnswers({ V2: '25-49', V5: 'Most leads come from one source' });
    const sub = selectSubDiagnosis(PILLARS.ACQUISITION, answers);
    assert.equal(sub.name, 'Channel concentration risk');
  });

  it('selects "Lead quality mismatch" when A1 = "0-5" and others neutral', () => {
    const answers = buildAnswers({ A1: '0-5' });
    const sub = selectSubDiagnosis(PILLARS.ACQUISITION, answers);
    assert.equal(sub.name, 'Lead quality mismatch');
  });

  it('picks highest-scoring sub when multiple match — V2 "0-9" (+2) beats A1 "6-10" (+1)', () => {
    const answers = buildAnswers({ V2: '0-9', A1: '6-10' });
    const sub = selectSubDiagnosis(PILLARS.ACQUISITION, answers);
    assert.equal(sub.name, 'Demand shortfall'); // V2 gave +2, A1 gave +1
  });

  it('returns null when no conditions match', () => {
    const answers = buildAnswers({}); // all neutral
    const sub = selectSubDiagnosis(PILLARS.ACQUISITION, answers);
    assert.equal(sub, null);
  });
});

describe('selectSubDiagnosis — Conversion', () => {
  it('selects "Speed-to-lead leak" for V3 = "3+ days"', () => {
    const answers = buildAnswers({ V3: '3+ days' });
    const sub = selectSubDiagnosis(PILLARS.CONVERSION, answers);
    assert.equal(sub.name, 'Speed-to-lead leak');
  });

  it('selects "Ownership leak" for C1 = "No consistent owner"', () => {
    const answers = buildAnswers({ C1: 'No consistent owner' });
    const sub = selectSubDiagnosis(PILLARS.CONVERSION, answers);
    assert.equal(sub.name, 'Ownership leak');
  });

  it('selects "Booking friction leak" for C2 = "15+ days"', () => {
    const answers = buildAnswers({ C2: '15+ days' });
    const sub = selectSubDiagnosis(PILLARS.CONVERSION, answers);
    assert.equal(sub.name, 'Booking friction leak');
  });

  it('selects "Attendance leak" for V4 = "Under 40%"', () => {
    const answers = buildAnswers({ V4: 'Under 40%' });
    const sub = selectSubDiagnosis(PILLARS.CONVERSION, answers);
    assert.equal(sub.name, 'Attendance leak');
  });

  it('selects "Follow-up leak" for C3 = "Can\'t reach them / slow follow-up"', () => {
    const answers = buildAnswers({ C3: "Can't reach them / slow follow-up" });
    const sub = selectSubDiagnosis(PILLARS.CONVERSION, answers);
    assert.equal(sub.name, 'Follow-up leak');
  });

  it('selects "Quote follow-up leak" for C3 = "They ghost after the quote"', () => {
    const answers = buildAnswers({ C3: 'They ghost after the quote' });
    const sub = selectSubDiagnosis(PILLARS.CONVERSION, answers);
    assert.equal(sub.name, 'Quote follow-up leak');
  });

  it('forces "Quote follow-up leak" over "Attendance leak" when both match', () => {
    const answers = buildAnswers({ C3: 'They ghost after the quote', V4: 'Under 40%' });
    const sub = selectSubDiagnosis(PILLARS.CONVERSION, answers);
    assert.equal(sub.name, 'Quote follow-up leak');
  });

  it('keeps "Attendance leak" when V4 is low but C3 is not ghost-after-quote', () => {
    const answers = buildAnswers({ V4: 'Under 40%', C3: 'Not sure' });
    const sub = selectSubDiagnosis(PILLARS.CONVERSION, answers);
    assert.equal(sub.name, 'Attendance leak');
  });

  it('prefers higher-scoring sub when V3 (+2) and C1 (+2) both match — uses definition order', () => {
    const answers = buildAnswers({ V3: '3+ days', C1: 'No consistent owner' });
    const sub = selectSubDiagnosis(PILLARS.CONVERSION, answers);
    // Both +2, tied → definition order → "Speed-to-lead leak" is first
    assert.equal(sub.name, 'Speed-to-lead leak');
  });
});

describe('selectSubDiagnosis — Retention', () => {
  it('selects "No retention cadence" for R1 = "Rarely/Never"', () => {
    const answers = buildAnswers({ R1: 'Rarely/Never' });
    const sub = selectSubDiagnosis(PILLARS.RETENTION, answers);
    assert.equal(sub.name, 'No retention cadence');
  });

  it('selects "Low compounding" for R3 = "Most revenue comes from new customers"', () => {
    const answers = buildAnswers({ R3: 'Most revenue comes from new customers' });
    const sub = selectSubDiagnosis(PILLARS.RETENTION, answers);
    assert.equal(sub.name, 'Low compounding');
  });

  it('selects "At-risk base" for R2 = "Shrunk"', () => {
    const answers = buildAnswers({ R2: 'Shrunk' });
    const sub = selectSubDiagnosis(PILLARS.RETENTION, answers);
    assert.equal(sub.name, 'At-risk base');
  });
});

// ===================================================================
// Key signal selection
// ===================================================================

describe('selectKeySignals', () => {
  it('picks V3 signal when V3 = "3+ days" (+2)', () => {
    const answers = buildAnswers({ V3: '3+ days' });
    const signals = selectKeySignals(answers);
    assert.ok(signals.length >= 1);
    assert.ok(signals[0].includes('response time'));
  });

  it('picks V4 signal when V4 = "Under 40%" (+2)', () => {
    const answers = buildAnswers({ V4: 'Under 40%' });
    const signals = selectKeySignals(answers);
    assert.ok(signals.some((s) => s.includes('show rate')));
  });

  it('picks at most 2 signals', () => {
    const answers = buildAnswers({
      V3: '3+ days',
      V4: 'Under 40%',
      V5: 'Most leads come from one source',
    });
    const signals = selectKeySignals(answers);
    assert.ok(signals.length <= 2);
  });

  it('returns empty array when no +2 answers exist', () => {
    const signals = selectKeySignals(buildAnswers({}));
    assert.equal(signals.length, 0);
  });
});

// ===================================================================
// Signal line formatting
// ===================================================================

describe('formatSignalsLine', () => {
  it('formats single signal correctly', () => {
    const line = formatSignalsLine(['response time is 3+ days']);
    assert.equal(line, 'Based on your answers: response time is 3+ days.');
  });

  it('formats two signals with "and"', () => {
    const line = formatSignalsLine(['response time is 3+ days', 'show rate is Under 40%']);
    assert.equal(line, 'Based on your answers: response time is 3+ days, and show rate is Under 40%.');
  });

  it('returns empty string for no signals', () => {
    assert.equal(formatSignalsLine([]), '');
  });
});

// ===================================================================
// Sub-diagnosis-specific next steps coverage
// ===================================================================

describe('FASTEST_NEXT_STEPS — coverage', () => {
  it('every sub-diagnosis name has a matching next-steps entry', () => {
    for (const pillar of Object.values(PILLARS)) {
      const subs = SUB_DIAGNOSES[pillar];
      if (!subs) continue;
      for (const sub of subs) {
        assert.ok(
          FASTEST_NEXT_STEPS[sub.name],
          `Missing FASTEST_NEXT_STEPS entry for sub-diagnosis "${sub.name}"`
        );
        assert.equal(FASTEST_NEXT_STEPS[sub.name].length, 2,
          `FASTEST_NEXT_STEPS["${sub.name}"] should have exactly 2 bullets`);
      }
    }
  });

  it('fallback entries exist for all pillars', () => {
    for (const pillar of Object.values(PILLARS)) {
      assert.ok(FASTEST_NEXT_STEPS_FALLBACK[pillar],
        `Missing FASTEST_NEXT_STEPS_FALLBACK for pillar "${pillar}"`);
      assert.equal(FASTEST_NEXT_STEPS_FALLBACK[pillar].length, 2);
    }
  });
});

// ===================================================================
// Full integration via generateResults()
// ===================================================================

describe('generateResults — integration', () => {
  it('generates correct results for clear Acquisition win', () => {
    const fixture = fixtures.CLEAR_ACQUISITION;
    const scoring = scoreQuiz(fixture.answers);
    const results = generateResults(scoring, fixture.answers);

    assert.ok(results.primaryGapStatement.includes('Acquisition'));
    assert.equal(results.subDiagnosis, 'Demand shortfall');
    assert.ok(results.subDiagnosisDisplay.includes('demand shortfall'));
    assert.equal(results.costOfLeak, 'Often 1-3 missed opportunities/month');
    assert.equal(results.fastestNextSteps.length, 2);
  });

  it('returns sub-diagnosis-specific next steps for Demand shortfall', () => {
    const fixture = fixtures.CLEAR_ACQUISITION;
    const scoring = scoreQuiz(fixture.answers);
    const results = generateResults(scoring, fixture.answers);

    assert.equal(results.subDiagnosis, 'Demand shortfall');
    assert.ok(results.fastestNextSteps[0].includes('lead volume'),
      'Demand shortfall next step should mention lead volume, not channel dependence');
    assert.ok(!results.fastestNextSteps[0].includes('single channel'),
      'Demand shortfall next step should NOT mention single channel');
  });

  it('returns sub-diagnosis-specific next steps for Channel concentration risk', () => {
    const answers = buildAnswers({ V2: '25-49', V5: 'Most leads come from one source' });
    const scoring = scoreQuiz(answers);
    const results = generateResults(scoring, answers);

    // Channel concentration should mention single channel
    if (results.subDiagnosis === 'Channel concentration risk') {
      assert.ok(results.fastestNextSteps[0].includes('single channel'));
    }
  });

  it('generates correct results for clear Conversion win', () => {
    const fixture = fixtures.CLEAR_CONVERSION;
    const scoring = scoreQuiz(fixture.answers);
    const results = generateResults(scoring, fixture.answers);

    assert.ok(results.primaryGapStatement.includes('Conversion'));
    assert.equal(results.subDiagnosis, 'Speed-to-lead leak');
    assert.equal(results.costOfLeak, 'Often 10-30% of leads leak before booking');
    assert.ok(results.keySignals.length >= 1);
    assert.ok(results.keySignalsLine.startsWith('Based on your answers'));
  });

  it('generates correct results for clear Retention win', () => {
    const fixture = fixtures.CLEAR_RETENTION;
    const scoring = scoreQuiz(fixture.answers);
    const results = generateResults(scoring, fixture.answers);

    assert.ok(results.primaryGapStatement.includes('Retention'));
    assert.equal(results.subDiagnosis, 'No retention cadence');
    assert.equal(results.costOfLeak, 'Often 10-25% revenue is trapped in churn/no-repeat');
    assert.ok(results.costOfLeakAdvice.includes('compound'));
  });

  it('handles neutral answers gracefully (no sub-diagnosis) — uses fallback next steps', () => {
    const scoring = scoreQuiz(buildAnswers({}));
    const results = generateResults(scoring, buildAnswers({}));

    assert.equal(results.subDiagnosis, null);
    assert.equal(results.subDiagnosisDisplay, null);
    assert.equal(results.keySignals.length, 0);
    assert.equal(results.keySignalsLine, '');
    // Should still have gap statement and fallback next steps
    assert.ok(results.primaryGapStatement.length > 0);
    assert.equal(results.fastestNextSteps.length, 2);
  });
});
