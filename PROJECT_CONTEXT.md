# MindtheGaps MVP — Project Context (Deep Reference)

This file contains the complete technical specifications for the MindtheGaps MVP build. Referenced by CLAUDE.md. Use this as the source of truth when implementing any component.

---

## 1. QUIZ SCORING ENGINE

### 1.1 Complete Scoring Matrix

Each answer maps to 0, +1, or +2 points for one pillar. V1 is non-scoring.

| Q# | ID | Pillar | Answer → +2 pts | Answer → +1 pt | All other answers → 0 |
|----|-----|--------|-----------------|-----------------|----------------------|
| 1 | V1 | — | N/A (non-scoring, tie-break only) | — | All answers = 0 |
| 2 | V2 | Acquisition | "0-9" | "10-24" | "25-49", "50+", "Not sure" |
| 3 | V3 | Conversion | "3+ days" | "1-2 days" | "Within 15 minutes", "Within 1 hour", "Same day", "Not sure" |
| 4 | V4 | Conversion | "Under 40%" | "40-59%" | "80%+", "60-79%", "Not sure" |
| 5 | V5 | Acquisition | "Most leads come from one source" | "Two sources" | "Three or more sources", "Not sure" |
| 6 | A1 | Acquisition | "0-5" | "6-10" | "11-15", "16-20", "Not sure" |
| 7 | C1 | Conversion | "No consistent owner" | "Varies" | "Coordinator/Front desk", "Sales", "Specialist", "Owner", "Not sure" |
| 8 | C2 | Conversion | "15+ days" | "8-14 days" | "Same day", "1-2 days", "3-7 days", "Not sure" |
| 9 | C3 | MIXED — see below | — | — | — |
| 10 | C4 | Conversion | "90+ days" | "31-90 days" | "Same day", "2-7 days", "8-14 days", "15-30 days", "Not sure" |
| 11 | R1 | Retention | "Rarely/Never" | "Yearly" | "Monthly", "Quarterly", "Twice per year", "Not sure" |
| 12 | R2 | Retention | "Shrunk" | "Flat" | "Grown", "Not sure" |
| 13 | R3 | Retention | "Most revenue comes from new customers" | "Roughly split between new and existing customers" | "Most revenue comes from existing customers", "Not sure" |

### C3 Special Routing (Question 9)

C3 ("What's the biggest reason leads don't book?") routes points to DIFFERENT pillars based on the answer:

| C3 Answer | Pillar | Points | Internal tag |
|-----------|--------|--------|-------------|
| "Can't reach them / slow follow-up" | Conversion | +2 | speed/follow-up |
| "They ghost after the quote" | Conversion | +2 | follow-up |
| "Price objections" | Conversion | +1 | offer clarity |
| "Not the right fit" | Acquisition | +1 | targeting |
| "Not sure" | — | 0 | — |

### 1.2 Max Possible Points Per Pillar

To calculate baseline score, you need the theoretical maximum for each pillar:

**Acquisition max:** V2(2) + V5(2) + A1(2) + C3-if-fit(1) = **7 points**
- But C3 can only contribute to ONE pillar per response
- If C3 answer = "Not the right fit": Acquisition gets +1, max = 7
- Otherwise: Acquisition max = 6

**Conversion max:** V3(2) + V4(2) + C1(2) + C2(2) + C3-if-slow-or-ghost(2) + C4(2) = **12 points**
- If C3 = "Can't reach them / slow follow-up" or "They ghost after the quote": +2 → max = 12
- If C3 = "Price objections": +1 → max = 11
- Otherwise: max = 10

**Retention max:** R1(2) + R2(2) + R3(2) = **6 points**

**IMPORTANT: For baseline score calculation, use the ACTUAL max possible for that gap given the C3 answer chosen.** The formula is:

```
baseline_score = ROUND(100 × (winning_gap_total / max_possible_for_winning_gap_given_C3_answer), 0)
```

### 1.3 Tie-Break Rules (applied in order when two+ pillars are tied)

1. **Conversion wins** if: response time (V3) is "1-2 days" or "3+ days" OR show rate (V4) is "Under 40%" or "40-59%"
2. **Acquisition wins** if: lead volume (V2) is "0-9" or "10-24" AND top-source dependence (V5) is "Most leads come from one source" or "Two sources"
3. **Retention wins** if: review cadence (R1) is "Yearly" or "Rarely/Never" AND revenue mix (R3) is "Most revenue comes from new customers" or "Roughly split between new and existing customers"
4. **V1 answer** as final tie-break:
   - "Getting more leads (Acquisition)" → Acquisition
   - "Turning leads into booked work (Conversion)" → Conversion
   - "Getting repeats/referrals (Retention)" → Retention
   - "Not sure" → use the first pillar alphabetically among tied pillars

### 1.4 Sub-Diagnosis Mapping

After determining Primary Gap, select the sub-diagnosis based on answer patterns:

**If Primary Gap = Acquisition:**
| Sub-diagnosis | Condition |
|--------------|-----------|
| Demand shortfall | V2 = "0-9" or "10-24" |
| Channel concentration risk | V5 = "Most leads come from one source" |
| Lead quality mismatch | A1 = "0-5" or "6-10" (fit ≤50%) |

Priority: if multiple match, pick the one with the highest contributing score. If still tied, use the order above.

**If Primary Gap = Conversion:**
| Sub-diagnosis | Condition |
|--------------|-----------|
| Speed-to-lead leak | V3 = "1-2 days" or "3+ days" |
| Ownership leak | C1 = "No consistent owner" |
| Booking friction leak | C2 = "8-14 days" or "15+ days" |
| Attendance leak | V4 = "Under 40%" or "40-59%" |
| Follow-up leak | C3 = "Can't reach them / slow follow-up" or "They ghost after the quote" |

Priority: pick the sub-diagnosis whose triggering answer contributed the most points. If tied, use the order above.

**If Primary Gap = Retention:**
| Sub-diagnosis | Condition |
|--------------|-----------|
| No retention cadence | R1 = "Yearly" or "Rarely/Never" |
| Low compounding | R3 = "Most revenue comes from new customers" or "Roughly split" |
| At-risk base | R2 = "Flat" or "Shrunk" |

Priority: pick the one with the highest contributing score. If tied, use the order above.

### 1.5 Key Signals (for "Based on your answers" line)

Pick the top 1-2 strongest signals from these fields (strongest = gave +2 points):
- Response time (V3)
- Show rate (V4)
- Top-source dependence (V5)
- Revenue mix (R3)
- Review cadence (R1) or existing-client trend (R2)

Format: "Based on your answers: [signal 1], and [signal 2]."

Examples:
- "Based on your answers: most leads come from one source, and response time is 1-2 days."
- "Based on your answers: show rate is 40-59%, and it takes 8-14 days to get to a first meeting."
- "Based on your answers: revenue relies mostly on new customers, and account reviews are yearly or less."

### 1.6 Cost-of-Leak Templates

| Primary Gap | Cost-of-leak text | How-to-say-it text |
|-------------|------------------|-------------------|
| Acquisition | "Often 1-3 missed opportunities/month" | "If demand is the bottleneck, small changes can unlock a steady flow of qualified leads." |
| Conversion | "Often 10-30% of leads leak before booking" | "Most conversion gains come from speed, ownership, and follow-up." |
| Retention | "Often 10-25% revenue is trapped in churn/no-repeat" | "Retention systems compound: repeats, reviews, and referrals." |

### 1.7 Results Page Templates

**Primary gap statement templates:**
- Acquisition: "Your primary growth gap is **Acquisition** (getting enough qualified leads)."
- Conversion: "Your primary growth gap is **Conversion** (turning leads into booked work)."
- Retention: "Your primary growth gap is **Retention** (repeats, reviews, referrals, and expansion)."

**Sub-diagnosis templates (select 1-2 based on answers):**

Acquisition:
- "You're exposed to a single source of leads (concentration risk)."
- "Lead volume is too low to hit growth targets (demand shortfall)."
- "Too many leads are not a fit (lead quality mismatch)."

Conversion:
- "Speed is the leak: leads wait too long for a first response."
- "Ownership is the leak: there's no consistent first responder."
- "Booking is the leak: it takes too long to get to a first meeting."
- "Follow-up is the leak: too many leads disappear after initial interest."

Retention:
- "Retention is accidental: there's no consistent account review cadence."
- "Compounding is weak: revenue relies mostly on new customers (or is split)."
- "The base is at risk: revenue from existing clients is flat or shrinking."

**Fastest next step templates (2 bullets, select by Primary Gap):**

If Acquisition:
- "Add one additional reliable lead source (so you're not dependent on a single channel)."
- "Improve lead fit by tightening your offer + ideal customer definition."

If Conversion:
- "Set a first-response standard and assign one owner (so leads never 'float')."
- "Reduce time-to-meeting with a simple booking path and consistent follow-up."

If Retention:
- "Create a simple review cadence (monthly or quarterly) with a clear owner."
- "Grow existing-customer revenue with a simple follow-up rhythm (and add a referral ask where it fits)."

### 1.8 Eligibility Logic

**Eligible for paid scan ($295 CAD) if ALL true:**
1. Decision-maker (owner/GM or delegated lead) will attend
2. Can share basic numbers (even rough estimates) for leads, response time, booking/show outcomes
3. Has active demand or an active client base right now (plan isn't theoretical)
4. Willing to focus on one lever (Acquire OR Convert OR Retain)

**Not eligible (fix-first reasons):**
- "No clear owner for growth changes" → fix: assign an owner for response/booking/follow-up
- "No basic numbers available" → fix: pull rough counts for the last 30 days
- "No active demand to work with" → fix: run a simple reactivation push first
- "Offer/ideal customer is too unclear" → fix: define one core offer and who it's for

**MVP preference:** Location = Ontario is a preference for scheduling/outreach, NOT a disqualifier.

---

## 2. HUBSPOT PROPERTY LIST (Complete)

All properties use `mtg_` prefix, lower_snake_case. Create in a custom property group called "MindtheGaps".

### Profile Fields
```
mtg_first_name              single-line text
mtg_business_name           single-line text
mtg_industry                dropdown
mtg_location                dropdown: Ontario / Elsewhere in Canada / United States / Other
mtg_team_size               dropdown: <10 / 10-24 / 25-49 / 50-100 / 100+
mtg_website_url             single-line text (optional)
mtg_phone                   phone number (optional)
```

### Quiz Output Fields
```
mtg_quiz_completed          checkbox (boolean)
mtg_quiz_completed_at       datetime
mtg_primary_gap             dropdown: Acquisition / Conversion / Retention
mtg_quiz_score              number (0-100)
mtg_sub_diagnosis           dropdown (see sub-diagnosis list in Section 1.4)
mtg_key_signals             multi-line text (JSON or pipe-delimited)
mtg_gap_causes              multi-line text
mtg_action_suggestions      multi-line text
mtg_cost_of_leak            single-line text
mtg_scan_eligible           checkbox (boolean)
mtg_fix_first_reason        single-line text (blank if eligible)
```

### Quiz Raw Answer Fields (14 dropdowns)
```
mtg_quiz_v1     dropdown (4 options)
mtg_quiz_v2     dropdown (5 options)
mtg_quiz_v3     dropdown (6 options)
mtg_quiz_v4     dropdown (5 options)
mtg_quiz_v5     dropdown (4 options)
mtg_quiz_a1     dropdown (5 options)
mtg_quiz_c1     dropdown (7 options)
mtg_quiz_c2     dropdown (6 options)
mtg_quiz_c3     dropdown (5 options)
mtg_quiz_c4     dropdown (7 options)
mtg_quiz_r1     dropdown (6 options)
mtg_quiz_r2     dropdown (4 options)
mtg_quiz_r3     dropdown (4 options)
```

### Payment Fields
```
mtg_payment_status          dropdown: Pending / Paid / Refunded
mtg_payment_amount          number
mtg_payment_currency        single-line text (e.g. CAD)
mtg_payment_date            datetime
mtg_stripe_payment_id       single-line text
```

### Booking Fields
```
mtg_scan_booked             checkbox (boolean)
mtg_scan_booked_at          datetime
mtg_scan_scheduled_for      datetime
mtg_calendly_event_id       single-line text
```

### Scan Output Fields
```
mtg_scan_completed          checkbox (boolean)
mtg_scan_completed_at       datetime
mtg_scan_primary_gap_confirmed  dropdown: Acquisition / Conversion / Retention
mtg_scan_sub_path           dropdown (see Section 3 for full list)
mtg_scan_one_lever          single-line text
mtg_scan_one_lever_sentence multi-line text
mtg_scan_confidence         dropdown: High / Med / Low
mtg_confidence_not_sure_count   number
mtg_scan_stop_reason        single-line text (blank if no stop)
```

### Plan Fields
```
mtg_plan_draft_link         single-line text (R2 URL)
mtg_plan_drafted_at         datetime
mtg_plan_review_status      dropdown: Pending / Approved / Rejected / Manual Required
mtg_plan_reviewer_notes     multi-line text
mtg_plan_sent_at            datetime
mtg_plan_status             dropdown: Draft / Reviewed / Sent
mtg_plan_generation_mode    dropdown: Auto / Stopped
```

---

## 3. SCAN WORKSHEET FIELD DICTIONARY

### Sub-path Options (by Primary Gap)

**Conversion sub-paths:**
- Speed-to-lead (slow first response)
- Booking friction (hard to book / long delays)
- Show rate (no-shows / reschedules)
- Quote follow-up / decision drop-off (ghosting after quote)
- Other (forces manual plan)

**Acquisition sub-paths:**
- Channel concentration risk (too dependent on one lead source)
- Demand capture / local visibility (not enough inbound demand)
- Lead capture friction (site/form/call handling leaks)
- Fit mismatch (wrong leads; low qualification)
- Referral / partner flow is not intentional
- Other (forces manual plan)

**Retention sub-paths:**
- Rebook/recall gap (next step not scheduled)
- Review rhythm gap (happy clients not asked at the right time)
- Referral ask gap (referrals happen by luck)
- Post-service follow-up gap (no check-ins/reminders)
- Other (forces manual plan)

### One Lever Options (by Primary Gap)

**Conversion levers:**
- Response ownership + SLA + follow-up sequence
- Booking standardization (one path) + confirmations/reminders
- Show-rate lift package (what to expect + reminders + prep)
- Quote turnaround + after-quote follow-up package
- Other (manual)

**Acquisition levers:**
- Add a secondary warm channel + weekly cadence (reduce single-source risk)
- Fix lead capture path (one page, one CTA, one follow-up path)
- Call handling + response ownership + SLA (speed-to-lead for inbound)
- Qualification gate (2-3 questions) to improve fit
- Review generation rhythm (simple ask + timing)
- Other (manual)

**Retention levers:**
- Rebook/recall system (prompt + script + schedule)
- Review + referral moment (timing + script + 2-step ask)
- Post-service check-in (30-day touch + simple template)
- Win-back for dormant clients (light touch sequence)
- Other (manual)

### Tier-1 Baseline Fields (by Primary Gap)

**Conversion baseline (7 fields):**
1. Inbound leads per month: 0-10 / 11-25 / 26-50 / 51-100 / 100+ / Not sure
2. Typical first response time: <1 hour / same day / 1-2 days / 3+ days / Not sure
3. Lead→booked %: 0-20% / 21-40% / 41-60% / 61%+ / Not sure
4. Booked→show %: 0-40% / 41-60% / 61-80% / 81%+ / Not sure
5. Time to first appointment: same day / 1-3 days / 4-7 days / 8-14 days / 15+ days / Not sure
6. Quote sent timeline: same day / 48 hours / 3-5 days / 7+ days / Not sure
7. Quote→close %: 0-10% / 11-20% / 21-30% / 31-50% / 51%+ / Not sure

**Acquisition baseline (7 fields):**
1. Inbound leads per month: 0-10 / 11-25 / 26-50 / 51-100 / 100+ / Not sure
2. Top lead source dependence: 1 source / 2 sources / 3-4 sources / 5+ sources / Not sure
3. % of leads from top source: 0-40% / 41-60% / 61-80% / 81%+ / Not sure
4. Calls answered live: always / often / sometimes / rarely / not sure / not applicable
5. Website lead capture friction: low / medium / high / not sure
6. Reviews per month: 0 / 1-2 / 3-5 / 6+ / Not sure
7. Referral intros per month: 0 / 1-2 / 3-5 / 6+ / Not sure

**Retention baseline (6 fields):**
1. % revenue from repeat: 0-20% / 21-40% / 41-60% / 61%+ / Not sure
2. % revenue from referrals: 0-10% / 11-20% / 21-30% / 31%+ / Not sure
3. Rebook/next-step scheduling: always scheduled / often / sometimes / rarely / not sure
4. Reviews per month: 0 / 1-2 / 3-5 / 6+ / Not sure
5. Time to follow-up after service/job: same day / 1-2 days / 3-7 days / 8+ days / Not sure
6. Customer check-in rhythm exists: yes (scheduled) / yes (ad hoc) / no / not sure

### Weekly Scorecard Metric Options (by Primary Gap)

**Conversion metrics:** Median response time • Lead→booked % • Show rate % • Quote sent within 48h %
**Acquisition metrics:** Leads/week • % leads from top source • Calls answered live % • Median response time • Reviews/week • Referral intros/week
**Retention metrics:** Rebook rate (or count) • Reviews/week • Referral intros/week • 30-day follow-up completion % • Repeat revenue band

---

## 4. STOP RULES (Complete)

Plan generation is HALTED (and Marc notified) if ANY of these are true:

1. **Sub-path = "not sure"** → Set sub-path to "Other (manual)", DO NOT auto-generate
2. **Sub-path = "Other (manual)"** at any point → DO NOT auto-generate
3. **Primary gap changed** from quiz without an update reason provided
4. **Missing required fields:** Must have ALL of: primary gap + sub-path + one lever + ≥5 Tier-1 baseline fields (non-"Not sure") + all 6 action slots + ≥2 metrics
5. **Contradiction** between gap confirmation fields and the stated primary gap (without acknowledged update)

When stopped:
- Write `mtg_scan_stop_reason` to HubSpot with specific reason
- Set `mtg_plan_review_status` to "Manual Required"
- Email Marc with: contact email, stop reason, and what's missing

---

## 5. PLAN GENERATION RULES

### Traceability Map (which plan section uses which data)

| Plan Section | Data Source | Required? |
|-------------|------------|-----------|
| A) What we found — biggest leak | Primary gap (confirmed) + sub-path from Section 2B | YES |
| A) Sub-diagnosis | Section 2B Field 1 (biggest leak selection) | YES |
| A) Supporting signal | Section 2B Field 2 (tie-breaker metric) | YES |
| A) "Based on your answers" line | Quiz key signals (prefilled from quiz) | NO |
| B) Baseline metrics | Section 3 Tier-1 fields (gap-specific, 5+ required) | YES |
| C) One Lever name | Section 4 dropdown selection | YES |
| C) "What we fix first" statement | Section 4 one-sentence text (≤160 chars) | YES |
| C) "What done looks like" | Primary metric from Section 6 + 30-day target | YES |
| D) 6 Actions + Owner + Due | Section 5 (all 6 slots required) | YES |
| E) Weekly scorecard | Section 6 metric picklist (≥2 metrics) | YES |
| F) Risks/Constraints | Section 7 (optional, but required if confidence = Med/Low) | CONDITIONAL |

### Confidence-Based Rules
- **High confidence:** Constraints section is optional in plan
- **Medium/Low confidence:** Must include at least 1 constraint row (max 3)
- **Low confidence:** Include a "Data gaps to measure" box in the plan

### Content Rules
- Plain language only. No jargon.
- Use ranges, not exact numbers (matches input style)
- Actions must be doable without client homework that blocks the ≤24h plan SLA
- No upsell during call; only after plan delivery in the "next steps" block

---

## 6. QA TEST CASES

### Quiz Tests (12)
1. Quiz renders on mobile + desktop
2. All quiz questions match spec (order + exact options)
3. Required fields block submit
4. Email validates format
5. Results page shows: primary gap + sub-diagnosis + cost-of-leak + signals
6. Submission creates/updates HubSpot Contact
7. HubSpot: mtg_quiz_completed, mtg_primary_gap, mtg_quiz_score populated
8. List fields store without truncation
9. Re-submit same email → updates existing Contact (no duplicate)
10. Eligible flow → Stripe checkout → Calendly booking works
11. Not-eligible flow → fix-first message displays correctly
12. Payment failure → appropriate error handling

### Scan→Plan Tests (15)
1. Worksheet usable live by facilitator (≤45 minutes)
2. Required fields enforced
3. Conditional sections show/hide correctly
4. Prefill works (quiz data appears in read-only fields)
5. Worksheet submission updates HubSpot Contact
6. If stop rules pass → plan draft created + link stored in HubSpot
7. Draft matches One-Page Plan Template structure
8. Draft includes: one lever, 6 actions, due dates, weekly scorecard
9. Personalization applied
10. Marc gets notification with draft link + confidence level
11. No auto-send (human review required)
12. STOP: "not sure" sub-path → no draft, stop_reason logged, Marc notified
13. STOP: contradiction → no draft, stop_reason logged, Marc notified
14. Edge: duplicate email → merge/update behavior correct
15. Edge: R2 upload fails → error logged, Marc alerted

---

## 7. ENVIRONMENT VARIABLES (per Worker)

```
HUBSPOT_API_KEY          # HubSpot private app token
CLAUDE_API_KEY           # Anthropic API key
STRIPE_WEBHOOK_SECRET    # Stripe webhook signing secret
CALENDLY_WEBHOOK_SECRET  # Calendly webhook signing secret
RESEND_API_KEY           # Resend email API key
R2_BUCKET_NAME           # Cloudflare R2 bucket name
MARC_EMAIL               # Marc's email for notifications
RESULTS_PAGE_URL         # URL of the hosted results page
```
