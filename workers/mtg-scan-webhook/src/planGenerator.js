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
// Step 5 "What We Fix First" — predetermined locked value per sub-path
//
// Authoritative plan-ready text. Always used for the opener sentence
// regardless of what JotForm sends.
// ---------------------------------------------------------------------------

const STEP5_WHAT_WE_FIX = Object.freeze({
  // Acquisition
  'Channel concentration risk':          'Reduce channel risk: add one secondary warm channel and run a weekly routine so leads don\'t rely on one source.',
  'Lead capture friction':               'Stop lead leakage: pick one capture route, assign ownership, and meet a same-day response rule.',
  'Demand capture / local visibility':   'Increase inbound demand: run a weekly visibility routine and add one warm channel that consistently drives local leads.',
  'Other (manual):Acquisition':          'Improve acquisition consistency: pick one channel and run a simple weekly routine so lead flow becomes predictable.',
  // Conversion
  'Speed-to-lead':                       'Speed up first response: assign one owner, meet a same-day response rule, and run a simple follow-up sequence.',
  'Booking friction':                    'Make booking easy: use one booking path, confirm fast, and reduce no-shows with reminders.',
  'Show rate':                           'Lift show rate: set expectations, confirm twice, and make rescheduling simple.',
  'Quote follow-up / decision drop-off': 'Stop quote ghosting: commit to a quote turnaround rule and follow up on a clear schedule.',
  'Other (manual):Conversion':           'Improve conversion consistency: tighten follow-up and tracking across stages so the biggest leak becomes clear and improves.',
  // Retention
  'Rebook/recall gap':                   'Build recall: set a recall schedule and make \'next appointment\' a standard step at job end.',
  'Review rhythm gap':                   'Increase reviews: choose the best moment to ask and run a simple weekly follow-up habit.',
  'Referral ask gap':                    'Increase referrals: install a simple ask and a weekly follow-up habit so intros become consistent.',
  'Post-service follow-up gap':          'Install follow-up: add a simple check-in + next-step prompt so clients don\'t go silent after service.',
  'Other (manual):Retention':            'Improve retention consistency: pick one follow-up habit and one metric so retention improves without a big rebuild.',
});

// ---------------------------------------------------------------------------
// Step 5 helper narration — facilitator reads aloud before the locked value
// ---------------------------------------------------------------------------

const STEP5_HELPER_NARRATION = Object.freeze({
  // Acquisition
  'Channel concentration risk':          'Based on your 12-minute quiz results and what you just confirmed today, leads rely too much on one source, which makes growth fragile. So our first move is:',
  'Lead capture friction':               'Based on your 12-minute quiz results and what you just confirmed today, leads are slipping through because capture and response aren\'t consistent. So our first move is:',
  'Demand capture / local visibility':   'Based on your 12-minute quiz results and what you just confirmed today, inbound demand is too light because local visibility and capture aren\'t strong enough. So our first move is:',
  'Other (manual):Acquisition':          'Based on your 12-minute quiz results and what you just confirmed today, the acquisition issue is mixed or unclear, so we\'ll pick one practical focus for the next 30 days. So our first move is:',
  // Conversion
  'Speed-to-lead':                       'Based on your 12-minute quiz results and what you just confirmed today, leads are not being contacted fast enough, so you lose jobs before you even respond. So our first move is:',
  'Booking friction':                    'Based on your 12-minute quiz results and what you just confirmed today, it\'s too hard for leads to book, so interested prospects drop off. So our first move is:',
  'Show rate':                           'Based on your 12-minute quiz results and what you just confirmed today, bookings are not turning into shows, so time is wasted and revenue becomes unstable. So our first move is:',
  'Quote follow-up / decision drop-off': 'Based on your 12-minute quiz results and what you just confirmed today, quotes are not being followed up with a simple decision path, so deals stall or die. So our first move is:',
  'Other (manual):Conversion':           'Based on your 12-minute quiz results and what you just confirmed today, the conversion issue is mixed or unclear, so we\'ll pick one practical focus for the next 30 days. So our first move is:',
  // Retention
  'Rebook/recall gap':                   'Based on your 12-minute quiz results and what you just confirmed today, customers are not coming back on a predictable schedule. So our first move is:',
  'Review rhythm gap':                   'Based on your 12-minute quiz results and what you just confirmed today, reviews are not being asked for and collected in a steady rhythm. So our first move is:',
  'Referral ask gap':                    'Based on your 12-minute quiz results and what you just confirmed today, referrals are not being asked for in a consistent, low-pressure way. So our first move is:',
  'Post-service follow-up gap':          'Based on your 12-minute quiz results and what you just confirmed today, post-service follow-up is not happening, so repeat and referral opportunities are missed. So our first move is:',
  'Other (manual):Retention':            'Based on your 12-minute quiz results and what you just confirmed today, the retention issue is mixed or unclear, so we\'ll pick one practical focus for the next 30 days. So our first move is:',
});

// ---------------------------------------------------------------------------
// Predetermined actions — 6 actions per sub-path (84 total)
//
// Each entry: { description, helperNarration, owner, dueDay }
//   description    — plan-ready text (always used, not overridable from form)
//   helperNarration — facilitator reads aloud (JotForm sublabel)
//   owner          — default role (overridable from form)
//   dueDay         — default day target (overridable from form)
//
// Due day pattern: Actions 1-2 = Day 7, Actions 3-4 = Day 21, Actions 5-6 = Day 45
// Owner sources: Acquisition/Retention = per-action values, Conversion = reference lines
// ---------------------------------------------------------------------------

const PREDETERMINED_ACTIONS = Object.freeze({

  // ── A1: Channel concentration risk ──────────────────────────────────────
  'Channel concentration risk': [
    { description: 'Identify top source and why it dominates.',
      helperNarration: 'First, we take one practical step without a big rebuild. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Choose ONE secondary warm channel to add.',
      helperNarration: 'Next, we pick one clear path so leads don\'t get lost. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Create one simple message + call-to-action for that channel.',
      helperNarration: 'Then, we take one practical step without a big rebuild. The action is:',
      owner: 'Marketing/Admin', dueDay: 21 },
    { description: 'Set a weekly routine: make a short task list and block 30 minutes to do it.',
      helperNarration: 'After that, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Ops lead', dueDay: 21 },
    { description: 'Track % leads from top source weekly; adjust one thing.',
      helperNarration: 'Now, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
    { description: 'Standardize weekly lead source review.',
      helperNarration: 'Finally, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
  ],

  // ── A2: Lead capture friction ───────────────────────────────────────────
  'Lead capture friction': [
    { description: 'Choose ONE lead capture route (call/website request/booking) and remove competing call-to-actions.',
      helperNarration: 'First, we pick one clear path so leads don\'t get lost. The action is:',
      owner: 'Marketing/Admin', dueDay: 7 },
    { description: 'Set response owner + same-day response rule + short script.',
      helperNarration: 'Next, we respond faster so you win the lead. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Add an immediate auto-reply for website requests: confirm we got it + tell them when you\'ll respond.',
      helperNarration: 'Then, we reassure the lead right away so they don\'t drift. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Missed-call rule: return call within X hours + 2 follow-ups.',
      helperNarration: 'After that, we respond faster so you win the lead. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Simple intake note format: problem/location/urgency.',
      helperNarration: 'Now, we capture the same basics every time so follow-up is easy. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
    { description: 'Weekly check: spot-check 10 leads and confirm response met same-day response rule.',
      helperNarration: 'Finally, we respond faster so you win the lead. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
  ],

  // ── A3: Demand capture / local visibility ───────────────────────────────
  'Demand capture / local visibility': [
    { description: 'Define ONE clear offer + service area on one simple lead page.',
      helperNarration: 'First, we take one practical step without a big rebuild. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Set a weekly visibility routine: 2 posts, 1 partner reach-out, and 5 review asks.',
      helperNarration: 'Next, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Marketing/Admin', dueDay: 7 },
    { description: 'Install review-ask script + timing rule; 10-minute team train.',
      helperNarration: 'Then, we respond faster so you win the lead. The action is:',
      owner: 'Ops lead', dueDay: 21 },
    { description: 'Add one secondary warm channel + intro script + weekly outreach list.',
      helperNarration: 'After that, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Weekly 15-minute scorecard review; adjust one thing.',
      helperNarration: 'Now, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
    { description: 'Lightweight follow-up rule: same-day response + 2 follow-ups.',
      helperNarration: 'Finally, we respond faster so you win the lead. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
  ],

  // ── A4: Other (manual):Acquisition ──────────────────────────────────────
  'Other (manual):Acquisition': [
    { description: 'Pick ONE acquisition lever and define a weekly activity target.',
      helperNarration: 'First, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Write one simple message and one clear call-to-action to use in the weekly routine.',
      helperNarration: 'Next, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Marketing/Admin', dueDay: 7 },
    { description: 'Build a weekly list/work queue.',
      helperNarration: 'Then, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Run that weekly routine for 2 weeks and note what worked.',
      helperNarration: 'After that, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Track leads/week weekly; adjust one thing.',
      helperNarration: 'Now, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
    { description: 'Write down the weekly routine (who does what and when) so it stays consistent.',
      helperNarration: 'Finally, we do a quick weekly check so the plan stays real. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
  ],

  // ── C1: Speed-to-lead ──────────────────────────────────────────────────
  'Speed-to-lead': [
    { description: 'Assign a lead-response owner + backup and commit to same-day first response.',
      helperNarration: 'First, we respond faster so you don\'t lose the job. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Use a 3-touch follow-up schedule (Day 0/2/5) using short pre-written messages.',
      helperNarration: 'Next, we keep deals moving with a simple follow-up habit. The action is:',
      owner: 'Admin/CSR', dueDay: 7 },
    { description: 'Add an immediate auto-reply for website requests: confirm we got it + tell them when you\'ll respond.',
      helperNarration: 'Then, we reduce no-shows with simple reminders. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Run a daily 10-minute lead review to clear any unassigned or unresponded leads.',
      helperNarration: 'After that, we review weekly and fix the biggest bottleneck. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Track response time weekly and fix the single biggest delay in the process.',
      helperNarration: 'Now, we respond faster so you don\'t lose the job. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
    { description: 'Standardize the first-call script : (1) what\'s the issue, (2) where is it, (3) how urgent is it \u2014 then book the next step.',
      helperNarration: 'Finally, we make booking easy so people don\'t drop off. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
  ],

  // ── C2: Booking friction ───────────────────────────────────────────────
  'Booking friction': [
    { description: 'Choose ONE booking path (phone OR booking link) and remove extra/competing options.',
      helperNarration: 'First, we make booking easy so people don\'t drop off. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Set booking expectations: next available window + what\'s needed to book.',
      helperNarration: 'Next, we make booking easy so people don\'t drop off. The action is:',
      owner: 'Admin/CSR', dueDay: 7 },
    { description: 'Send confirmations + reminders (24h + 2h) and include "reply to confirm.".',
      helperNarration: 'Then, we reduce no-shows with simple reminders. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Pre-confirm the basics: decision maker, address, and access details.',
      helperNarration: 'After that, we reduce no-shows with simple reminders. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Review time-to-first-appointment weekly and adjust calendar blocks if needed.',
      helperNarration: 'Now, we review weekly and fix the biggest bottleneck. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
    { description: 'Create a waitlist and a cancellation-fill rule to backfill openings fast.',
      helperNarration: 'Finally, we take one practical step without a big rebuild. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
  ],

  // ── C3: Show rate ──────────────────────────────────────────────────────
  'Show rate': [
    { description: 'Send a "what to expect" message (arrival window, length, and prep).',
      helperNarration: 'First, we take one practical step without a big rebuild. The action is:',
      owner: 'Admin/CSR', dueDay: 7 },
    { description: 'Use a reminder sequence (24h + 2h) plus a simple "easy reschedule" rule.',
      helperNarration: 'Next, we reduce no-shows with simple reminders. The action is:',
      owner: 'Admin/CSR', dueDay: 7 },
    { description: 'Use a short prep checklist (photos, measurements, decision maker) before quoting.',
      helperNarration: 'Then, we standardize the words so the team is consistent. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Send a day-before confirmation: "Are we still good for tomorrow?".',
      helperNarration: 'After that, we reduce no-shows with simple reminders. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Track no-show reasons weekly and make one adjustment each week.',
      helperNarration: 'Now, we review weekly and fix the biggest bottleneck. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
    { description: 'Use a simple "fill the gap" process for same-day cancellations.',
      helperNarration: 'Finally, we respond faster so you don\'t lose the job. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
  ],

  // ── C4: Quote follow-up / decision drop-off ────────────────────────────
  'Quote follow-up / decision drop-off': [
    { description: 'Set a quote turnaround rule (\u226448 hours) and assign clear ownership.',
      helperNarration: 'First, we respond faster so you don\'t lose the job. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Use a 3-step follow-up schedule (Day 2/5/10) with short pre-written messages.',
      helperNarration: 'Next, we keep deals moving with a simple follow-up habit. The action is:',
      owner: 'Admin/CSR', dueDay: 7 },
    { description: 'Add a 5-minute quote walkthrough to confirm fit and remove confusion.',
      helperNarration: 'Then, we reduce no-shows with simple reminders. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Ask one decision-blocker question in follow-up: "What would stop you from moving ahead?".',
      helperNarration: 'After that, we keep deals moving with a simple follow-up habit. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Track quote-to-close weekly and review 3 lost deals for one pattern to fix.',
      helperNarration: 'Now, we keep deals moving with a simple follow-up habit. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
    { description: 'Standardize quote request format so it is clear: scope, price, timeline, and next step.',
      helperNarration: 'Finally, we keep deals moving with a simple follow-up habit. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
  ],

  // ── C5: Other (manual):Conversion ──────────────────────────────────────
  'Other (manual):Conversion': [
    { description: 'Assign one owner for follow-up consistency and run a weekly review.',
      helperNarration: 'First, we keep deals moving with a simple follow-up habit. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Define follow-up expectations by stage (response, booking, reminders, quote follow-up).',
      helperNarration: 'Next, we respond faster so you don\'t lose the job. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Use simple scripts/pre-written messages for "next step" at each stage.',
      helperNarration: 'Then, we standardize the words so the team is consistent. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Track one weekly metric per stage and flag the weakest stage.',
      helperNarration: 'After that, we review weekly and fix the biggest bottleneck. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Fix one recurring conversion bottleneck identified in the weekly review.',
      helperNarration: 'Now, we review weekly and fix the biggest bottleneck. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
    { description: 'Run a weekly conversion review and keep one improvement per cycle.',
      helperNarration: 'Finally, we review weekly and fix the biggest bottleneck. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
  ],

  // ── R1: Rebook/recall gap ──────────────────────────────────────────────
  'Rebook/recall gap': [
    { description: 'Choose recall schedule (6m/12m etc.).',
      helperNarration: 'First, we set the foundation so this can happen every time. This keeps repeat work on the calendar instead of hoping they come back. The action is:',
      owner: 'Ops lead', dueDay: 7 },
    { description: 'At the end of the job, ask the customer to book their next service now (use a short, standard line).',
      helperNarration: 'Next, we make it easy to rebook while the job is fresh. This is a simple ask at the end of the visit so repeat work gets booked early. The action is:',
      owner: 'Ops lead', dueDay: 7 },
    { description: 'Set up recall reminders based on the service interval (6/12 months): send a short text/email when it\'s time to book.',
      helperNarration: 'Then, we send a reminder at the right time so customers don\'t forget. This is tied to their service interval (like 6 or 12 months), not a random monthly blast. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'After each job, mark whether the next appointment is booked (Yes/No). If "No," trigger a follow-up step.',
      helperNarration: 'After that, we add a simple check so nothing slips through. If the next visit isn\'t booked, we know we need a follow-up. The action is:',
      owner: 'Ops lead', dueDay: 21 },
    { description: 'Track rebook count weekly/monthly; fix biggest drop-off.',
      helperNarration: 'Now, we make it consistent so the team can run it without thinking. This keeps repeat work on the calendar instead of hoping they come back. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
    { description: 'Light win-back for missed recall clients.',
      helperNarration: 'Finally, we add a quick check so we know it\'s working and can tighten it. This keeps repeat work on the calendar instead of hoping they come back. The action is:',
      owner: 'Owner/GM', dueDay: 45 },
  ],

  // ── R2: Review rhythm gap ──────────────────────────────────────────────
  'Review rhythm gap': [
    { description: 'Pick best moment to ask (end of service/after issue resolved).',
      helperNarration: 'First, we set the foundation so this can happen every time. This is a practical step to improve results without a big rebuild. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Create 2-step ask: review then introduction.',
      helperNarration: 'Next, now that the foundation is in place, we make the next step easy for the customer. This makes review asks simple so more customers say yes. The action is:',
      owner: 'Admin/CSR', dueDay: 7 },
    { description: 'Train team on script (10 minutes).',
      helperNarration: 'Then, we remove friction so more people actually follow through. This is a practical step to improve results without a big rebuild. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Weekly follow-up for \'yes\' who didn\'t post.',
      helperNarration: 'After that, we add a simple nudge so people don\'t forget or drift. This keeps the relationship warm after the job is done. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Track reviews/week + referral intros/week; adjust timing/script.',
      helperNarration: 'Now, we make it consistent so the team can run it without thinking. This makes review asks simple so more customers say yes. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
    { description: 'Create one \'thank you\' response pre-written message for referrals.',
      helperNarration: 'Finally, we add a quick check so we know it\'s working and can tighten it. This adds a simple referral ask so happy customers send people your way. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
  ],

  // ── R3: Referral ask gap (same actions as R2, different Step 5) ────────
  'Referral ask gap': [
    { description: 'Pick best moment to ask (end of service/after issue resolved).',
      helperNarration: 'First, we set the foundation so this can happen every time. This is a practical step to improve results without a big rebuild. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Create 2-step ask: review then introduction.',
      helperNarration: 'Next, now that the foundation is in place, we make the next step easy for the customer. This makes review asks simple so more customers say yes. The action is:',
      owner: 'Admin/CSR', dueDay: 7 },
    { description: 'Train team on script (10 minutes).',
      helperNarration: 'Then, we remove friction so more people actually follow through. This is a practical step to improve results without a big rebuild. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Weekly follow-up for \'yes\' who didn\'t post.',
      helperNarration: 'After that, we add a simple nudge so people don\'t forget or drift. This keeps the relationship warm after the job is done. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Track reviews/week + referral intros/week; adjust timing/script.',
      helperNarration: 'Now, we make it consistent so the team can run it without thinking. This makes review asks simple so more customers say yes. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
    { description: 'Create one \'thank you\' response pre-written message for referrals.',
      helperNarration: 'Finally, we add a quick check so we know it\'s working and can tighten it. This adds a simple referral ask so happy customers send people your way. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
  ],

  // ── R4: Post-service follow-up gap ─────────────────────────────────────
  'Post-service follow-up gap': [
    { description: 'Define what \'repeat\' means + pick one follow-up trigger.',
      helperNarration: 'First, we set the foundation so this can happen every time. This keeps the relationship warm after the job is done. The action is:',
      owner: 'Admin/CSR', dueDay: 7 },
    { description: 'Create 30-day check-in pre-written message (text/email).',
      helperNarration: 'Next, now that the foundation is in place, we make the next step easy for the customer. This keeps the relationship warm after the job is done. The action is:',
      owner: 'Admin/CSR', dueDay: 7 },
    { description: 'Add \'next step\' prompt at job end (maintenance/seasonal check).',
      helperNarration: 'Then, we remove friction so more people actually follow through. This is a practical step to improve results without a big rebuild. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Run light win-back message to past clients.',
      helperNarration: 'After that, we add a simple nudge so people don\'t forget or drift. This uses a short message so it\'s easy to do every time. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Track follow-up completion weekly; improve one bottleneck.',
      helperNarration: 'Now, we make it consistent so the team can run it without thinking. This keeps the relationship warm after the job is done. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
    { description: 'Standardize rebook ask script for techs/admin.',
      helperNarration: 'Finally, we add a quick check so we know it\'s working and can tighten it. This keeps repeat work on the calendar instead of hoping they come back. The action is:',
      owner: 'Ops lead', dueDay: 45 },
  ],

  // ── R5: Other (manual):Retention ───────────────────────────────────────
  'Other (manual):Retention': [
    { description: 'Confirm the biggest retention leak using one weekly metric and one owner.',
      helperNarration: 'First, we set the foundation so this can happen every time. This keeps the plan real, not just written. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Choose one retention lever for the next 30 days and define the next-step process.',
      helperNarration: 'Next, now that the foundation is in place, we make the next step easy for the customer. This is a practical step to improve results without a big rebuild. The action is:',
      owner: 'Owner/GM', dueDay: 7 },
    { description: 'Use a simple script/pre-written message for the selected follow-up step.',
      helperNarration: 'Then, we remove friction so more people actually follow through. This keeps the relationship warm after the job is done. The action is:',
      owner: 'Admin/CSR', dueDay: 21 },
    { description: 'Track the chosen retention metric weekly and note the main blocker.',
      helperNarration: 'After that, we add a simple nudge so people don\'t forget or drift. This keeps the plan real, not just written. The action is:',
      owner: 'Owner/GM', dueDay: 21 },
    { description: 'Fix one retention bottleneck (timing, wording, follow-up, or no owner).',
      helperNarration: 'Now, we make it consistent so the team can run it without thinking. This keeps the relationship warm after the job is done. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
    { description: 'Run a weekly retention review and make one improvement each cycle.',
      helperNarration: 'Finally, we add a quick check so we know it\'s working and can tighten it. This makes review asks simple so more customers say yes. The action is:',
      owner: 'Admin/CSR', dueDay: 45 },
  ],
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
  'Days to follow-up after service':       'ret_follow_up_time',
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
  const subPathKey = scanData.subPath || '';
  const whatWeFixFirst = STEP5_WHAT_WE_FIX[subPathKey]
    || STEP5_WHAT_WE_FIX[subPathKey + ':' + (scanData.primaryGap || '')];
  const opener = whatWeFixFirst
    || scanData.oneLeverSentence
    || (scanData.subPath && scanData.oneLever
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

  // Section D: Action Plan (predetermined from lookup, with owner/due override)
  const predeterminedActions = PREDETERMINED_ACTIONS[subPathKey]
    || PREDETERMINED_ACTIONS[subPathKey + ':' + (scanData.primaryGap || '')];

  const sectionD = {
    actions: predeterminedActions
      ? predeterminedActions.map((pa, i) => ({
          description: pa.description,
          owner: (scanData.actions && scanData.actions[i]?.owner) || pa.owner,
          dueDate: (scanData.actions && scanData.actions[i]?.dueDate) || `Day ${pa.dueDay}`,
        }))
      : (scanData.actions || []).map((a) => ({
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
    STEP5_WHAT_WE_FIX,
    STEP5_HELPER_NARRATION,
    PREDETERMINED_ACTIONS,
  },
};
