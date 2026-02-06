/**
 * MindtheGaps — Scan Worksheet Test Fixtures
 *
 * Reusable scan data sets for stop rules, confidence, and plan generation tests.
 * Each fixture documents what the expected outcome should be and why.
 *
 * Uses the same sparse-override pattern as quiz testCases.js.
 */

const { PILLARS, BASELINE_FIELDS } = require('../workers/shared/constants');

// ---------------------------------------------------------------------------
// Helper: build a full scan data object from sparse overrides.
// Defaults produce a "clean" scan that passes all stop rules.
// ---------------------------------------------------------------------------

/**
 * Build a complete set of Conversion baseline fields with all answers filled.
 * Override individual fields by passing { conv_inbound_leads: 'Not sure' } etc.
 */
const DEFAULT_CONV_BASELINE = Object.freeze({
  conv_inbound_leads: '11-25',
  conv_first_response_time: 'same day',
  conv_lead_to_booked: '21-40%',
  conv_booked_to_show: '61-80%',
  conv_time_to_first_appointment: '1-3 days',
  conv_quote_sent_timeline: '48 hours',
  conv_quote_to_close: '21-30%',
});

const DEFAULT_ACQ_BASELINE = Object.freeze({
  acq_inbound_leads: '11-25',
  acq_top_source_dependence: '2 sources',
  acq_pct_from_top_source: '41-60%',
  acq_calls_answered_live: 'often',
  acq_website_capture_friction: 'medium',
  acq_reviews_per_month: '3-5',
  acq_referral_intros_per_month: '1-2',
});

const DEFAULT_RET_BASELINE = Object.freeze({
  ret_pct_revenue_repeat: '21-40%',
  ret_pct_revenue_referrals: '11-20%',
  ret_rebook_scheduling: 'often',
  ret_reviews_per_month: '1-2',
  ret_follow_up_time: '1-2 days',
  ret_check_in_rhythm: 'yes (ad hoc)',
});

const DEFAULT_BASELINES = Object.freeze({
  [PILLARS.CONVERSION]: DEFAULT_CONV_BASELINE,
  [PILLARS.ACQUISITION]: DEFAULT_ACQ_BASELINE,
  [PILLARS.RETENTION]: DEFAULT_RET_BASELINE,
});

/**
 * Default 6 action slots (filled).
 */
const DEFAULT_ACTIONS = Object.freeze([
  { description: 'Set up auto-response within 15 min', owner: 'Marc', dueDate: 'Week 1' },
  { description: 'Create follow-up email sequence', owner: 'Marc', dueDate: 'Week 1' },
  { description: 'Add booking link to all touchpoints', owner: 'VA', dueDate: 'Week 2' },
  { description: 'Set calendar reminder for quote follow-up', owner: 'Marc', dueDate: 'Week 2' },
  { description: 'Build after-quote text template', owner: 'VA', dueDate: 'Week 3' },
  { description: 'Install call tracking on website', owner: 'Marc', dueDate: 'Week 4' },
]);

/**
 * Default metrics (3 selected, need ≥2).
 */
const DEFAULT_METRICS = Object.freeze([
  'Response time (hours)',
  'Lead-to-booked rate (%)',
  'Quote-to-close rate (%)',
]);

/**
 * Build a complete scan data object. Defaults produce a Conversion scan
 * that passes all stop rules with High confidence.
 */
function buildScanData(overrides = {}) {
  const has = (key) => key in overrides;
  const primaryGap = has('primaryGap') ? overrides.primaryGap : PILLARS.CONVERSION;
  const baselineDefaults = DEFAULT_BASELINES[primaryGap] || DEFAULT_CONV_BASELINE;

  return {
    primaryGap,
    quizPrimaryGap: has('quizPrimaryGap') ? overrides.quizPrimaryGap : primaryGap,
    gapChangeReason: has('gapChangeReason') ? overrides.gapChangeReason : '',
    subPath: has('subPath') ? overrides.subPath : 'Speed-to-lead',
    oneLever: has('oneLever') ? overrides.oneLever : 'Response ownership + SLA + follow-up sequence',
    baselineFields: { ...baselineDefaults, ...(overrides.baselineFields || {}) },
    actions: has('actions') ? overrides.actions : [...DEFAULT_ACTIONS],
    metrics: has('metrics') ? overrides.metrics : [...DEFAULT_METRICS],
  };
}

/**
 * Build baseline fields with a specific number of "Not sure" answers.
 * Replaces the first N fields with "Not sure".
 */
function buildBaselineWithNotSure(primaryGap, notSureCount) {
  const defaults = { ...(DEFAULT_BASELINES[primaryGap] || DEFAULT_CONV_BASELINE) };
  const keys = BASELINE_FIELDS[primaryGap] || [];
  for (let i = 0; i < Math.min(notSureCount, keys.length); i++) {
    defaults[keys[i]] = 'Not sure';
  }
  return defaults;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
module.exports = {
  DEFAULT_CONV_BASELINE,
  DEFAULT_ACQ_BASELINE,
  DEFAULT_RET_BASELINE,
  DEFAULT_BASELINES,
  DEFAULT_ACTIONS,
  DEFAULT_METRICS,
  buildScanData,
  buildBaselineWithNotSure,
};
