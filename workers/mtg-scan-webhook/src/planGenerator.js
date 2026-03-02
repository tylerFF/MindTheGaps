/**
 * MindtheGaps — Deterministic Plan Generator
 *
 * Builds the planContent shape consumed by docxBuilder using ONLY data
 * from the scan worksheet. No AI calls — pure template logic.
 *
 * Spec reference: PROJECT_CONTEXT.md Section 5 (Plan Generation Rules)
 * Personalization: MindtheGaps_Plan_Personalization_Rules_BUILD_READY_FINAL2
 * Confidence: MindtheGaps_Plan_Confidence_and_Stop_Rules_BUILD_READY_FINAL2
 *
 * Public API:
 *   generatePlan(scanData, contactInfo, confidenceResult) → planContent
 */

const { BASELINE_FIELDS } = require('../../shared/constants');
const { BASELINE_LABELS } = require('./docxBuilder');

// ---------------------------------------------------------------------------
// Baseline range progressions (worst → best) for 30-day target lookup
//
// Target = next range toward "better". If already best, stays.
// ---------------------------------------------------------------------------

const RANGE_PROGRESSIONS = Object.freeze({
  // Conversion
  conv_inbound_leads:             ['0-10', '11-25', '26-50', '51-100', '100+'],
  conv_first_response_time:       ['3+ days', '1-2 days', 'Same day', '<1 hour'],
  conv_lead_to_booked:            ['0-20%', '21-40%', '41-60%', '61%+'],
  conv_booked_to_show:            ['0-40%', '41-60%', '61-80%', '81%+'],
  conv_time_to_first_appointment: ['15+ days', '8-14 days', '4-7 days', '1-3 days', 'Same day'],
  conv_quote_sent_timeline:       ['7+ days', '3-5 days', '48 hours', 'Same day'],
  conv_quote_to_close:            ['0-10%', '11-20%', '21-30%', '31-50%', '51%+'],

  // Acquisition
  acq_inbound_leads:              ['0-10', '11-25', '26-50', '51-100', '100+'],
  acq_top_source_dependence:      ['1 source', '2 sources', '3-4 sources', '5+ sources'],
  acq_pct_from_top_source:        ['81%+', '61-80%', '41-60%', '0-40%'],
  acq_calls_answered_live:        ['Rarely', 'Sometimes', 'Often', 'Always'],
  acq_website_capture_friction:   ['High', 'Medium', 'Low'],
  acq_reviews_per_month:          ['0', '1-2', '3-5', '6+'],
  acq_referral_intros_per_month:  ['0', '1-2', '3-5', '6+'],

  // Retention
  ret_pct_revenue_repeat:         ['0-20%', '21-40%', '41-60%', '61%+'],
  ret_pct_revenue_referrals:      ['0-10%', '11-20%', '21-30%', '31%+'],
  ret_rebook_scheduling:          ['Rarely', 'Sometimes', 'Often', 'Always scheduled'],
  ret_reviews_per_month:          ['0', '1-2', '3-5', '6+'],
  ret_follow_up_time:             ['8+ days', '3-7 days', '1-2 days', 'Same day'],
  ret_check_in_rhythm:            ['No', 'Yes (ad hoc)', 'Yes (scheduled)'],
});

// ---------------------------------------------------------------------------
// "Worst" ranges — values that indicate a problem (used for risk callout
// personalization + supporting signal selection)
// ---------------------------------------------------------------------------

const WORST_RANGES = Object.freeze({
  conv_first_response_time:       ['3+ days'],
  conv_lead_to_booked:            ['0-20%'],
  conv_booked_to_show:            ['0-40%'],
  conv_time_to_first_appointment: ['15+ days'],
  conv_quote_sent_timeline:       ['7+ days'],
  conv_quote_to_close:            ['0-10%'],
  acq_inbound_leads:              ['0-10'],
  acq_top_source_dependence:      ['1 source'],
  acq_pct_from_top_source:        ['81%+'],
  acq_calls_answered_live:        ['Rarely'],
  acq_website_capture_friction:   ['High'],
  acq_reviews_per_month:          ['0'],
  acq_referral_intros_per_month:  ['0'],
  ret_pct_revenue_repeat:         ['0-20%'],
  ret_pct_revenue_referrals:      ['0-10%'],
  ret_rebook_scheduling:          ['Rarely'],
  ret_reviews_per_month:          ['0'],
  ret_follow_up_time:             ['8+ days'],
  ret_check_in_rhythm:            ['No'],
});

// ---------------------------------------------------------------------------
// Stability-target triggers — high-dependence / low-reliability values
// (Personalization Pattern 3)
// ---------------------------------------------------------------------------

const STABILITY_TRIGGERS = Object.freeze({
  acq_top_source_dependence: ['1 source'],
  acq_pct_from_top_source:   ['61-80%', '81%+'],
  conv_first_response_time:  ['1-2 days', '3+ days'],
  ret_pct_revenue_repeat:    ['0-20%'],
});

// ---------------------------------------------------------------------------
// Risk context — explains WHY a worst baseline value is a problem.
// Used in the Risk/Mitigation insight (Pattern 2).
// ---------------------------------------------------------------------------

const RISK_CONTEXT = Object.freeze({
  conv_inbound_leads:             'Low lead volume leaves the pipeline vulnerable to dry spells.',
  conv_first_response_time:       'Slow response lets competitors win the lead first.',
  conv_lead_to_booked:            'Low booking rates mean marketing spend is being wasted.',
  conv_booked_to_show:            'No-shows waste scheduled time and capacity.',
  conv_time_to_first_appointment: 'Long wait times increase the chance prospects go elsewhere.',
  conv_quote_sent_timeline:       'Delayed quotes lose urgency and buyer momentum.',
  conv_quote_to_close:            'Low close rates signal a quoting or follow-up gap.',
  acq_inbound_leads:              'Low lead volume leaves the pipeline vulnerable to dry spells.',
  acq_top_source_dependence:      'Single-source dependence means one algorithm change can cut lead flow.',
  acq_pct_from_top_source:        'Heavy reliance on one channel is fragile.',
  acq_calls_answered_live:        'Missed calls are missed leads.',
  acq_website_capture_friction:   'High capture friction means website visitors leave without converting.',
  acq_reviews_per_month:          'Few reviews reduce trust signals for new prospects.',
  acq_referral_intros_per_month:  'Low referrals mean the business relies entirely on paid or organic leads.',
  ret_pct_revenue_repeat:         'Low repeat revenue means constant new-customer acquisition pressure.',
  ret_pct_revenue_referrals:      'Low referral revenue signals a missed growth lever.',
  ret_rebook_scheduling:          'Without rebooking prompts, customers drift and forget.',
  ret_reviews_per_month:          'Few reviews reduce trust signals for new prospects.',
  ret_follow_up_time:             'Delayed follow-up lets the relationship go cold.',
  ret_check_in_rhythm:            'No check-in rhythm means out-of-sight, out-of-mind.',
});

// ---------------------------------------------------------------------------
// Phrasing bank: MOST_LIKELY_LEAK (keyed by dropdown sub-path values)
//
// Maps the actual JotForm dropdown values to the spec's "Most likely leak"
// phrases. See README "Sub-Path Naming Mismatch" for dropdown→spec mapping.
// ---------------------------------------------------------------------------

const MOST_LIKELY_LEAK = Object.freeze({
  // Acquisition sub-paths
  'Demand capture / local visibility':        'Inbound demand is not steady enough to hit targets.',
  'Lead capture friction':                    'Leads are being lost at the capture/response step.',
  'Channel concentration risk':               'Lead flow is concentrated in one source, which raises risk.',
  // Conversion sub-paths
  'Speed-to-lead':                            'Speed-to-lead is too slow, which reduces bookings.',
  'Booking friction':                         'Booking is too slow or too hard, which reduces conversion.',
  'Show rate':                                'No-shows are reducing completed appointments.',
  'Quote follow-up / decision drop-off':      'Follow-up after quoting is not consistent, reducing close rate.',
  // Retention sub-paths
  'Post-service follow-up gap':               'There is no consistent post-service follow-up to drive repeat work.',
  'Review rhythm gap':                        'The ask is not happening at the best moment, so referrals/reviews stay low.',
  'Referral ask gap':                         'The ask is not happening at the best moment, so referrals/reviews stay low.',
  'Rebook/recall gap':                        'There is no reliable recall system to bring customers back.',
});

// ---------------------------------------------------------------------------
// Phrasing bank: WHAT_CHANGES (keyed by sub-path, with gap-level fallbacks)
//
// Describes the positive outcome if the leak is fixed.
// ---------------------------------------------------------------------------

const WHAT_CHANGES = Object.freeze({
  // Acquisition sub-paths → all map to same outcome
  'Demand capture / local visibility':        'More leads become booked work.',
  'Lead capture friction':                    'More leads become booked work.',
  'Channel concentration risk':               'More leads become booked work.',
  // Conversion sub-paths → specific to the sub-path
  'Speed-to-lead':                            'More leads become booked work.',
  'Booking friction':                         'More booked jobs actually show up.',
  'Show rate':                                'More booked jobs actually show up.',
  'Quote follow-up / decision drop-off':      'More quotes turn into signed work.',
  // Retention sub-paths
  'Post-service follow-up gap':               'More customers come back without new ad spend.',
  'Review rhythm gap':                        'More happy customers leave reviews and refer others.',
  'Referral ask gap':                         'More happy customers leave reviews and refer others.',
  'Rebook/recall gap':                        'More customers come back without new ad spend.',
});

// Gap-level fallbacks for WHAT_CHANGES (when sub-path doesn't match)
const WHAT_CHANGES_BY_GAP = Object.freeze({
  Acquisition: 'More leads become booked work.',
  Conversion:  'More leads become booked work.',
  Retention:   'More customers come back without new ad spend.',
});

// ---------------------------------------------------------------------------
// Metric name → baseline field key mapping
//
// Maps the metric names selected in Section 6 of the scan worksheet
// to the baseline field keys from Section 3 so we can pull the current
// value and compute a 30-day target.
// ---------------------------------------------------------------------------

const METRIC_TO_BASELINE = Object.freeze({
  // Conversion metrics (must match JotForm checkbox option text exactly)
  'Median response time':       'conv_first_response_time',
  'Lead to booked %':           'conv_lead_to_booked',
  'Show rate %':                'conv_booked_to_show',
  'Quote sent within 48h %':    'conv_quote_sent_timeline',

  // Acquisition metrics
  'Leads/week':                 'acq_inbound_leads',
  '% leads from top source':    'acq_pct_from_top_source',
  'Calls answered live %':      'acq_calls_answered_live',
  'Reviews/week':               null, // maps to pillar-specific below
  'Referral intros/week':       null, // maps to pillar-specific below

  // Retention metrics
  'Rebook rate (or count)':               'ret_rebook_scheduling',
  'Follow-up time after service':          'ret_follow_up_time',
  'Repeat revenue band':                  'ret_pct_revenue_repeat',
});

// Pillar-aware overrides for shared metric names
const METRIC_PILLAR_OVERRIDES = Object.freeze({
  'Reviews/week': {
    Acquisition: 'acq_reviews_per_month',
    Retention: 'ret_reviews_per_month',
  },
  'Referral intros/week': {
    Acquisition: 'acq_referral_intros_per_month',
  },
  'Median response time': {
    Acquisition: 'conv_first_response_time', // acquisition can reference response time
  },
});


// ---------------------------------------------------------------------------
// Helper: get 30-day target for a baseline field + current value
// ---------------------------------------------------------------------------

function getTarget(fieldKey, currentValue) {
  if (!currentValue || currentValue.toLowerCase() === 'not sure') {
    return 'Start tracking weekly.';
  }

  const progression = RANGE_PROGRESSIONS[fieldKey];
  if (!progression) return 'Improve';

  // Case-insensitive match
  const normalised = currentValue.trim().toLowerCase();
  const idx = progression.findIndex((r) => r.toLowerCase() === normalised);

  if (idx === -1) return 'Improve';
  if (idx >= progression.length - 1) return `Maintain ${progression[progression.length - 1]}`;

  return progression[idx + 1];
}

// ---------------------------------------------------------------------------
// Helper: resolve metric name to baseline field key (pillar-aware)
// ---------------------------------------------------------------------------

function resolveMetricField(metricName, primaryGap) {
  // Check pillar-specific overrides first
  const overrides = METRIC_PILLAR_OVERRIDES[metricName];
  if (overrides && overrides[primaryGap]) {
    return overrides[primaryGap];
  }
  return METRIC_TO_BASELINE[metricName] || null;
}

// ---------------------------------------------------------------------------
// Helper: find the "worst" performing baseline field for this pillar
// Returns { field, label, value } or null
// ---------------------------------------------------------------------------

function findWorstBaseline(scanData) {
  const gap = scanData.primaryGap;
  const fieldKeys = BASELINE_FIELDS[gap] || [];
  const baseline = scanData.baselineFields || {};

  for (const key of fieldKeys) {
    const value = baseline[key];
    if (!value || value.trim().toLowerCase() === 'not sure') continue;

    const worstValues = WORST_RANGES[key];
    if (worstValues && worstValues.some((w) => w.toLowerCase() === value.trim().toLowerCase())) {
      return {
        field: key,
        label: BASELINE_LABELS[key] || key,
        value: value.trim(),
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helper: count non-"Not sure" baseline answers
// ---------------------------------------------------------------------------

function countNonNotSure(scanData) {
  const gap = scanData.primaryGap;
  const fieldKeys = BASELINE_FIELDS[gap] || [];
  const baseline = scanData.baselineFields || {};
  let count = 0;

  for (const key of fieldKeys) {
    const value = baseline[key];
    if (value && value.trim() !== '' && value.trim().toLowerCase() !== 'not sure') {
      count++;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Helper: count "Not sure" baseline answers
// ---------------------------------------------------------------------------

function countNotSure(scanData) {
  const gap = scanData.primaryGap;
  const fieldKeys = BASELINE_FIELDS[gap] || [];
  const baseline = scanData.baselineFields || {};
  let count = 0;

  for (const key of fieldKeys) {
    const value = baseline[key];
    if (!value || value.trim() === '' || value.trim().toLowerCase() === 'not sure') {
      count++;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Helper: list "Not sure" baseline fields (for data gaps)
// ---------------------------------------------------------------------------

function listNotSureFields(scanData) {
  const gap = scanData.primaryGap;
  const fieldKeys = BASELINE_FIELDS[gap] || [];
  const baseline = scanData.baselineFields || {};
  const gaps = [];

  for (const key of fieldKeys) {
    const value = baseline[key];
    if (!value || value.trim() === '' || value.trim().toLowerCase() === 'not sure') {
      gaps.push(BASELINE_LABELS[key] || key);
    }
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// Section B: Baseline Metrics (reused from original — filters "Not sure")
// ---------------------------------------------------------------------------

function buildSectionBData(scanData) {
  const gap = scanData.primaryGap;
  const fieldKeys = BASELINE_FIELDS[gap] || [];
  const baseline = scanData.baselineFields || {};
  const metrics = [];

  for (const key of fieldKeys) {
    const value = baseline[key];
    if (
      value &&
      typeof value === 'string' &&
      value.trim() !== '' &&
      value.trim().toLowerCase() !== 'not sure'
    ) {
      metrics.push({
        field: BASELINE_LABELS[key] || key,
        value: value.trim(),
      });
    }
  }

  return metrics;
}

// ---------------------------------------------------------------------------
// Build personalization insight lines (max 2 per plan in MVP)
//
// Pattern 1: Signal-to-action (fastest win)
// Pattern 2: Risk callout
// Pattern 3: Stability target
// ---------------------------------------------------------------------------

function buildInsights(scanData, confidenceResult) {
  const insights = [];
  const gap = scanData.primaryGap;
  const fieldKeys = BASELINE_FIELDS[gap] || [];
  const baseline = scanData.baselineFields || {};
  const nonNotSureCount = countNonNotSure(scanData);
  const notSureCount = countNotSure(scanData);

  // Pattern 1: Signal-to-action
  // Trigger: Gap confirmed + sub-path selected + ≥4 non-"Not sure" baseline answers
  if (scanData.primaryGap && scanData.subPath && nonNotSureCount >= 4) {
    const worst = findWorstBaseline(scanData);
    const signal = worst
      ? `${worst.label} is ${worst.value}`
      : 'room to improve across several metrics';

    insights.push({
      pattern: 'signal_to_action',
      text: `Based on your answers, the fastest win is to focus on ${scanData.oneLever || 'the selected lever'} because your baseline shows ${signal} (this is the leak we can measure fastest).`,
      placement: 'sectionA', // appears in What We Found + One Lever headline
    });
  }

  // Pattern 2: Risk callout
  // Trigger: Any baseline at worst range OR ≥2 "Not sure"
  const worst = findWorstBaseline(scanData);
  if (worst || notSureCount >= 2) {
    let riskText;
    if (worst) {
      const context = RISK_CONTEXT[worst.field]
        || `This weakens overall ${(gap || 'growth').toLowerCase()} performance.`;
      riskText = `Risk: ${worst.label} is at ${worst.value}. ${context} Mitigation: We'll address this with a small proof step in the first 14 days, not a big rebuild.`;
    } else {
      riskText = `Risk: ${notSureCount} baseline metrics are unknown, so targeting is based on incomplete data. Mitigation: We'll address this with a small proof step in the first 14 days, not a big rebuild.`;
    }

    insights.push({
      pattern: 'risk_callout',
      text: riskText,
      placement: 'sectionF', // appears in Constraints box or under Actions
    });
  }

  // Pattern 3: Stability target
  // Trigger: High dependence / low reliability baseline value
  for (const key of fieldKeys) {
    const value = baseline[key];
    if (!value) continue;
    const triggers = STABILITY_TRIGGERS[key];
    if (triggers && triggers.some((t) => t.toLowerCase() === value.trim().toLowerCase())) {
      const target = getTarget(key, value.trim());
      insights.push({
        pattern: 'stability_target',
        text: `Your 60-day target is stability, not perfection: move from ${value.trim()} to ${target} so results don't depend on one fragile point of failure.`,
        placement: 'sectionE', // appears under metrics scoreboard
      });
      break; // only one stability insight
    }
  }

  // MVP: max 2 insight lines
  return insights.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Public API — deterministic plan generation
// ---------------------------------------------------------------------------

/**
 * Generate plan content deterministically from scan data.
 * No external API calls. Synchronous, pure function.
 *
 * @param {object} scanData — full scan data from worksheet
 * @param {object} contactInfo — { businessName, email, firstName, ... }
 * @param {object} confidenceResult — from calculateConfidence()
 * @returns {object} planContent — structured JSON for docxBuilder
 */
function generatePlan(scanData, contactInfo, confidenceResult) {
  const worst = findWorstBaseline(scanData);
  const baselineMetrics = buildSectionBData(scanData);

  // Section A: What We Found
  // 3.1: opener = oneLeverSentence verbatim; fallback if blank
  const opener = scanData.oneLeverSentence
    ? scanData.oneLeverSentence
    : (scanData.subPath && scanData.oneLever
        ? `Fix ${scanData.subPath} first by focusing on ${scanData.oneLever}.`
        : '');

  // 3.6: Phrasing bank lookups
  const mostLikelyLeak = MOST_LIKELY_LEAK[scanData.subPath] || '';
  const whatChanges = WHAT_CHANGES[scanData.subPath]
    || WHAT_CHANGES_BY_GAP[scanData.primaryGap]
    || '';

  // Phase 5 (3.4): Pass contradiction note through to sectionA
  const contradictionNote = (scanData.contradictionNote || '').trim();

  // Field 2: supporting data point for the plan (tie-breaker confirmation)
  const field2Answer = (scanData.field2Answer || '').trim();
  const field2Label = (scanData.field2Label || '').trim();

  // Phase 5 (3.5): Flag when sub-path is "Other (manual)"
  const isOtherSubPath = scanData.subPath
    && typeof scanData.subPath === 'string'
    && scanData.subPath.trim().toLowerCase().startsWith('other');
  const manualPlanFlag = isOtherSubPath
    ? 'Manual plan: sub-path was not selected with confidence. Human review required.'
    : '';

  const sectionA = {
    opener,
    mostLikelyLeak,
    whatChanges,
    contradictionNote,
    field2Answer,
    field2Label,
    manualPlanFlag,
    primaryGap: scanData.primaryGap || 'Unknown',
    subDiagnosis: scanData.subPath || 'Not identified',
    supportingSignal: worst
      ? `${worst.label}: ${worst.value}`
      : (baselineMetrics.length > 0
          ? `${baselineMetrics[0].field}: ${baselineMetrics[0].value}`
          : ''),
    quizKeySignals: scanData.quizKeySignals || '',
  };

  // Section B: Baseline Metrics
  const sectionB = { baselineMetrics };

  // Section C: One Lever
  const firstMetric = (scanData.metrics && scanData.metrics[0]) || '';
  const firstMetricField = resolveMetricField(firstMetric, scanData.primaryGap);
  const firstMetricBaseline = firstMetricField
    ? (scanData.baselineFields || {})[firstMetricField] || ''
    : '';
  const firstMetricTarget = firstMetricField
    ? getTarget(firstMetricField, firstMetricBaseline)
    : 'Improve';

  const sectionC = {
    leverName: scanData.oneLever || 'Not selected',
    leverDescription: '', // 3.1: moved to sectionA.opener
    whatDoneLooksLike: {
      metric: firstMetric || 'Primary scorecard metric',
      target: firstMetricTarget,
    },
  };

  // Section D: Action Plan (direct passthrough)
  const sectionD = {
    actions: (scanData.actions || []).map((a) => ({
      description: a.description || '',
      owner: a.owner || '',
      dueDate: a.dueDate || '',
    })),
  };

  // Pad to 6 actions if fewer
  while (sectionD.actions.length < 6) {
    sectionD.actions.push({ description: '', owner: '', dueDate: '' });
  }

  // Section E: Weekly Scorecard
  const sectionE = {
    metrics: (scanData.metrics || []).map((metricName) => {
      const fieldKey = resolveMetricField(metricName, scanData.primaryGap);
      const currentValue = fieldKey
        ? (scanData.baselineFields || {})[fieldKey] || 'TBD'
        : 'TBD';
      const target = fieldKey
        ? getTarget(fieldKey, currentValue)
        : 'Improve';

      return {
        name: metricName,
        baseline: currentValue,
        target30Day: target,
      };
    }),
  };

  // Section F: Risks / Constraints
  const constraints = scanData.constraints || [];
  const dataGaps = confidenceResult && confidenceResult.includeDataGaps
    ? listNotSureFields(scanData).map((f) => `Track: ${f}`)
    : [];

  const sectionF = {
    constraints: constraints.slice(0, 3),
    dataGaps,
  };

  // Personalization insight lines
  const insights = buildInsights(scanData, confidenceResult);

  return {
    sectionA,
    sectionB,
    sectionC,
    sectionD,
    sectionE,
    sectionF,
    insights,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  generatePlan,
  _internal: {
    buildSectionBData,
    buildInsights,
    getTarget,
    resolveMetricField,
    findWorstBaseline,
    countNonNotSure,
    countNotSure,
    listNotSureFields,
    RANGE_PROGRESSIONS,
    WORST_RANGES,
    STABILITY_TRIGGERS,
    METRIC_TO_BASELINE,
    METRIC_PILLAR_OVERRIDES,
    MOST_LIKELY_LEAK,
    WHAT_CHANGES,
    WHAT_CHANGES_BY_GAP,
    RISK_CONTEXT,
  },
};
