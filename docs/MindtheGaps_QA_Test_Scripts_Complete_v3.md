# MindtheGaps QA Test Scripts (Complete v3)

All tests use `tyler@bryantworks.com` as the contact email. Business name changes per test so they're easy to identify in HubSpot and the DOCX files. HubSpot contact gets overwritten each time (upsert by email).

Quiz URL: `https://mtg-pages-3yo.pages.dev/quiz/`
Scan Worksheet URL: `https://form.jotform.com/260435948553162`
DOCX save folder: `~/Downloads/Mind The Gaps Docx creation/`

Action text, owners, and days match MTG_Action_Ladder_Reference_v2.xlsx exactly.

---

## TEST Q1: 12-Minute Quiz (Acquisition)

This is the starting point. Submit once, then use the same email for all scan worksheet tests.

Quiz URL: `https://mtg-pages-3yo.pages.dev/quiz/`

**Quiz answers:**

| Question | ID | Answer |
|----------|-----|--------|
| Where does growth feel most stuck? | V1 | Getting more leads |
| New inbound leads per month? | V2 | 0-9 |
| How fast do leads get a first response? | V3 | Same day |
| What % of first meetings show up? | V4 | 60-79% |
| How dependent on top lead source? | V5 | Most leads come from one source |

**Profile fields:**

| Field | Value |
|-------|-------|
| First Name | Tyler |
| Email | tyler@bryantworks.com |
| Business Name | Loom Demo Plumbing |
| Industry | Home Services |
| Location | Ontario |
| Team Size | 10-24 |
| Website | (blank) |
| Phone | (blank) |

**Remaining questions:**

| Question | ID | Answer |
|----------|-----|--------|
| Last 20 inbound leads, how many good fit? | A1 | 0-5 |
| Who responds first to a new lead? | C1 | Owner |
| How long from first contact to first meeting? | C2 | 3-7 days |
| Biggest reason leads don't book? | C3 | Can't reach / slow follow-up |
| How long to close after first contact? | C4 | 8-14 days |
| How often do you review client accounts? | R1 | Quarterly |
| Revenue from existing clients? | R2 | Stayed flat |
| Where does most revenue come from? | R3 | Roughly split |

**Expected:** Primary Gap = Acquisition. HubSpot contact created with mtg_primary_gap = Acquisition.

---

## SCAN WORKSHEET SECTION 1 (same for every test)

| Field | Value |
|-------|-------|
| Contact Email | tyler@bryantworks.com |
| First Name | Tyler |
| Industry | Home Services |
| Phone | (blank) |

Business name changes per test. Primary Gap from Quiz stays Acquisition for every submission since that's what the quiz scored.

---

## ACQUISITION TESTS

---

### TEST A1: Channel concentration risk

Business Name: `TEST A1: Channel concentration risk`

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Acquisition |
| Sub-Path (Acquisition) | Channel concentration risk |
| Field 2: % leads from top source | 81%+ |

**Section 3 - Acquisition Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | Inbound leads per month | 11-25 |
| 2 | Top lead source dependence | 1 source |
| 3 | % leads from top source | 81%+ |
| 4 | Calls answered live | Often |
| 5 | [Acq] Website lead capture friction | Medium |
| 6 | [Acq] Reviews per month | Not sure |
| 7 | [Acq] Referral intros per month | 1-2 |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Add a secondary warm channel + weekly cadence |
| What we fix first | Reduce channel risk: add one secondary warm channel and run a weekly routine so leads don't rely on one source. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Identify top source and why it dominates. | Owner/GM | Day 7 |
| 2/6 | Choose ONE secondary warm channel to add. | Owner/GM | Day 7 |
| 3/6 | Create one simple message + call-to-action for that channel. | Marketing/Admin | Day 21 |
| 4/6 | Set a weekly routine: make a short task list and block 30 minutes to do it. | Ops lead | Day 21 |
| 5/6 | Track % leads from top source weekly; adjust one thing. | Owner/GM | Day 45 |
| 6/6 | Standardize weekly lead source review. | Owner/GM | Day 45 |

**Section 6 - Metrics:** % leads from top source, Leads/week, Reviews/week, Referral intros/week

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Channel concentration risk".
**DOCX name:** A1_Channel-concentration-risk_test.docx

---

### TEST A2: Demand capture / local visibility

Business Name: `TEST A2: Demand capture / local visibility`

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Acquisition |
| Sub-Path (Acquisition) | Demand capture / local visibility |
| Field 2: Inbound leads per month | 0-10 |

**Section 3 - Acquisition Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | Inbound leads per month | 0-10 |
| 2 | Top lead source dependence | 2 sources |
| 3 | % leads from top source | 41-60% |
| 4 | Calls answered live | Sometimes |
| 5 | [Acq] Website lead capture friction | High |
| 6 | [Acq] Reviews per month | 0 |
| 7 | [Acq] Referral intros per month | 0 |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Review generation rhythm (simple ask + timing) |
| What we fix first | Increase inbound demand: run a weekly visibility routine and add one warm channel that consistently drives local leads. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Define ONE clear offer + service area on one simple lead page. | Owner/GM | Day 7 |
| 2/6 | Set a weekly visibility routine: 2 posts, 1 partner reach-out, and 5 review asks. | Marketing/Admin | Day 7 |
| 3/6 | Install review-ask script + timing rule; 10-minute team train. | Ops lead | Day 21 |
| 4/6 | Add one secondary warm channel + intro script + weekly outreach list. | Owner/GM | Day 21 |
| 5/6 | Weekly 15-minute scorecard review; adjust one thing. | Owner/GM | Day 45 |
| 6/6 | Lightweight follow-up rule: same-day response + 2 follow-ups. | Admin/CSR | Day 45 |

**Section 6 - Metrics:** Leads/week, Reviews/week, Referral intros/week

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Demand capture / local visibility".
**DOCX name:** A2_Demand-capture_test.docx

---

### TEST A3: Lead capture friction

Business Name: `TEST A3: Lead capture friction`

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Acquisition |
| Sub-Path (Acquisition) | Lead capture friction |
| Field 2: Calls answered live | Rarely |

**Section 3 - Acquisition Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | Inbound leads per month | 26-50 |
| 2 | Top lead source dependence | 1 source |
| 3 | % leads from top source | 61-80% |
| 4 | Calls answered live | Rarely |
| 5 | [Acq] Website lead capture friction | High |
| 6 | [Acq] Reviews per month | 3-5 |
| 7 | [Acq] Referral intros per month | Not sure |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Fix lead capture path (one page, one CTA, one follow-up path) |
| What we fix first | Stop lead leakage: pick one capture route, assign ownership, and meet a same-day response rule. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Choose ONE lead capture route (call/website request/booking) and remove competing call-to-actions. | Marketing/Admin | Day 7 |
| 2/6 | Set response owner + same-day response rule + short script. | Owner/GM | Day 7 |
| 3/6 | Add an immediate auto-reply for website requests: confirm we got it + tell them when you'll respond. | Admin/CSR | Day 21 |
| 4/6 | Missed-call rule: return call within X hours + 2 follow-ups. | Admin/CSR | Day 21 |
| 5/6 | Simple intake note format: problem/location/urgency. | Admin/CSR | Day 45 |
| 6/6 | Weekly check: spot-check 10 leads and confirm response met same-day response rule. | Owner/GM | Day 45 |

**Section 6 - Metrics:** Median response time, Leads/week, Calls answered live %

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Lead capture friction".
**DOCX name:** A3_Lead-capture-friction_test.docx

---

## CONVERSION TESTS

---

### TEST C1: Speed-to-lead

Business Name: `TEST C1: Speed-to-lead`

Note: Quiz was Acquisition but scan confirmed Conversion. Quiz fields in HubSpot will still show Acquisition. That's expected.

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Conversion |
| Sub-Path (Conversion) | Speed-to-lead |
| Field 2: First response time | 1-2 days |

**Section 3 - Conversion Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | Inbound leads per month | 11-25 |
| 2 | Typical first response time | 1-2 days |
| 3 | Lead to booked % | 21-40% |
| 4 | Booked to show % | 60-79% |
| 5 | Time to first appointment | 4-7 days |
| 6 | Quote sent timeline | 48 hours |
| 7 | Quote to close % | Not sure |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Response ownership + SLA + follow-up sequence |
| What we fix first | Speed up first response: assign one owner, meet a same-day response rule, and run a simple follow-up sequence. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Assign a lead-response owner + backup and commit to same-day first response. | Owner/GM | Day 7 |
| 2/6 | Use a 3-touch follow-up schedule (Day 0/2/5) using short pre-written messages. | Admin/CSR | Day 7 |
| 3/6 | Add an immediate auto-reply for website requests: confirm we got it + tell them when you'll respond. | Admin/CSR | Day 21 |
| 4/6 | Run a daily 10-minute lead review to clear any unassigned or unresponded leads. | Owner/GM | Day 21 |
| 5/6 | Track response time weekly and fix the single biggest delay in the process. | Owner/GM | Day 45 |
| 6/6 | Standardize the first-call script: (1) what's the issue, (2) where is it, (3) how urgent is it -- then book the next step. | Owner/GM | Day 45 |

**Section 6 - Metrics:** Median response time, Lead to booked %, Show rate %

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Speed-to-lead".
**DOCX name:** C1_Speed-to-lead_test.docx

---

### TEST C2: Booking friction

Business Name: `TEST C2: Booking friction`

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Conversion |
| Sub-Path (Conversion) | Booking friction |
| Field 2: Days to first appointment | 8-14 |

**Section 3 - Conversion Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | Inbound leads per month | 26-50 |
| 2 | Typical first response time | Same day |
| 3 | Lead to booked % | 21-40% |
| 4 | Booked to show % | 61-80% |
| 5 | Time to first appointment | 8-14 days |
| 6 | Quote sent timeline | Not sure |
| 7 | Quote to close % | 21-30% |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Booking standardization (one path) + confirmations/reminders |
| What we fix first | Make booking easy: use one booking path, confirm fast, and reduce no-shows with reminders. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Choose ONE booking path (phone OR booking link) and remove extra/competing options. | Owner/GM | Day 7 |
| 2/6 | Set booking expectations: next available window + what's needed to book. | Admin/CSR | Day 7 |
| 3/6 | Send confirmations + reminders (24h + 2h) and include "reply to confirm." | Admin/CSR | Day 21 |
| 4/6 | Pre-confirm the basics: decision maker, address, and access details. | Admin/CSR | Day 21 |
| 5/6 | Review time-to-first-appointment weekly and adjust calendar blocks if needed. | Owner/GM | Day 45 |
| 6/6 | Create a waitlist and a cancellation-fill rule to backfill openings fast. | Admin/CSR | Day 45 |

**Section 6 - Metrics:** Lead to booked %, Show rate %, Median response time

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Booking friction".
**DOCX name:** C2_Booking-friction_test.docx

---

### TEST C3: Show rate

Business Name: `TEST C3: Show rate`

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Conversion |
| Sub-Path (Conversion) | Show rate |
| Field 2: Show rate % | <60% |

**Section 3 - Conversion Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | Inbound leads per month | 11-25 |
| 2 | Typical first response time | Same day |
| 3 | Lead to booked % | 41-60% |
| 4 | Booked to show % | 0-40% |
| 5 | Time to first appointment | 4-7 days |
| 6 | Quote sent timeline | Same day |
| 7 | Quote to close % | Not sure |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Show-rate lift package (what to expect + reminders + prep) |
| What we fix first | Lift show rate: set expectations, confirm twice, and make rescheduling simple. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Send a "what to expect" message (arrival window, length, and prep). | Admin/CSR | Day 7 |
| 2/6 | Use a reminder sequence (24h + 2h) plus a simple "easy reschedule" rule. | Admin/CSR | Day 7 |
| 3/6 | Use a short prep checklist (photos, measurements, decision maker) before quoting. | Owner/GM | Day 21 |
| 4/6 | Send a day-before confirmation: "Are we still good for tomorrow?" | Admin/CSR | Day 21 |
| 5/6 | Track no-show reasons weekly and make one adjustment each week. | Owner/GM | Day 45 |
| 6/6 | Use a simple "fill the gap" process for same-day cancellations. | Admin/CSR | Day 45 |

**Section 6 - Metrics:** Show rate %, Lead to booked %

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Show rate".
**DOCX name:** C3_Show-rate_test.docx

---

### TEST C4: Quote follow-up / decision drop-off

Business Name: `TEST C4: Quote follow-up`

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Conversion |
| Sub-Path (Conversion) | Quote follow-up / decision drop-off |
| Field 2: Quote-to-close % | 0-20% |

**Section 3 - Conversion Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | Inbound leads per month | 26-50 |
| 2 | Typical first response time | Same day |
| 3 | Lead to booked % | 41-60% |
| 4 | Booked to show % | 81%+ |
| 5 | Time to first appointment | 1-3 days |
| 6 | Quote sent timeline | 3-5 days |
| 7 | Quote to close % | 0-10% |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Quote turnaround + after-quote follow-up package |
| What we fix first | Stop quote ghosting: commit to a quote same-day response rule and follow up on a clear schedule. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Set a quote turnaround rule (48 hours or less) and assign clear ownership. | Owner/GM | Day 7 |
| 2/6 | Use a 3-step follow-up schedule (Day 2/5/10) with short pre-written messages. | Admin/CSR | Day 7 |
| 3/6 | Add a 5-minute quote walkthrough to confirm fit and remove confusion. | Owner/GM | Day 21 |
| 4/6 | Ask one decision-blocker question in follow-up: "What would stop you from moving ahead?" | Admin/CSR | Day 21 |
| 5/6 | Track quote-to-close weekly and review 3 lost deals for one pattern to fix. | Owner/GM | Day 45 |
| 6/6 | Standardize quote format so it is clear: scope, price, timeline, and next step. | Owner/GM | Day 45 |

**Section 6 - Metrics:** Quote sent within 48h %, Lead to booked %, Median response time

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Quote follow-up / decision drop-off".
**DOCX name:** C4_Quote-followup_test.docx

---

## RETENTION TESTS

Note on Retention baselines: JotForm uses more granular bands than some specs (e.g. 0-10% and 11-20% instead of 0-20%). Pick the closest option.

Note on Retention metrics: The JotForm checkbox label is "Days to follow-up after service" (not "30-day follow-up completion %" as some guides reference). Use whatever labels appear in the form.

---

### TEST R1: Rebook/recall gap

Business Name: `TEST R1: Rebook/recall gap`

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Retention |
| Sub-Path (Retention) | Rebook/recall gap |
| Field 2: Next step scheduled at job end | Rarely |

**Section 3 - Retention Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | % revenue from repeat | pick closest to 21-40% |
| 2 | % revenue from referrals | pick closest to 0-10% |
| 3 | Rebook/next-step scheduling | Rarely |
| 4 | Reviews per month | 1-2 |
| 5 | Time to follow-up after service | 8+ days |
| 6 | Customer check-in rhythm exists | No |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Rebook/recall system (prompt + script + schedule) |
| What we fix first | Build recall: set a recall schedule and make "next appointment" a standard step at job end. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Choose recall schedule (6m/12m etc.). | Owner/GM | Day 7 |
| 2/6 | At the end of the job, ask the customer to book their next service now (use a short, standard line). | Ops lead | Day 7 |
| 3/6 | Set up recall reminders based on the service interval (6/12 months): send a short text/email when it's time to book. | Admin/CSR | Day 21 |
| 4/6 | After each job, mark whether the next appointment is booked (Yes/No). If "No," trigger a follow-up step. | Ops lead | Day 21 |
| 5/6 | Track rebook count weekly/monthly; fix biggest drop-off. | Owner/GM | Day 45 |
| 6/6 | Light win-back for missed recall clients. | Admin/CSR | Day 45 |

**Section 6 - Metrics:** Rebook rate (or count), Repeat revenue band

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Rebook/recall gap".
**DOCX name:** R1_Rebook-recall-gap_test.docx

---

### TEST R2: Review rhythm gap

Business Name: `TEST R2: Review rhythm gap`

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Retention |
| Sub-Path (Retention) | Review rhythm gap |
| Field 2 | (none, this sub-path has no Field 2) |

**Section 3 - Retention Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | % revenue from repeat | pick closest to 41-60% |
| 2 | % revenue from referrals | pick closest to 0-10% |
| 3 | Rebook/next-step scheduling | Often |
| 4 | Reviews per month | 0 |
| 5 | Time to follow-up after service | 3-7 days |
| 6 | Customer check-in rhythm exists | Yes (ad hoc) |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Review + referral moment (timing + script + 2-step ask) |
| What we fix first | Increase reviews: choose the best moment to ask and run a simple weekly follow-up habit. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Pick best moment to ask (end of service/after issue resolved). | Owner/GM | Day 7 |
| 2/6 | Create 2-step ask: review then introduction. | Admin/CSR | Day 7 |
| 3/6 | Train team on script (10 minutes). | Owner/GM | Day 21 |
| 4/6 | Weekly follow-up for 'yes' who didn't post. | Admin/CSR | Day 21 |
| 5/6 | Track reviews/week + referral intros/week; adjust timing/script. | Ops lead | Day 45 |
| 6/6 | Create one 'thank you' response pre-written message for referrals. | Admin/CSR | Day 45 |

**Section 6 - Metrics:** Reviews/week, Referral intros/week

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Review rhythm gap".
**DOCX name:** R2_Review-rhythm-gap_test.docx

---

### TEST R3: Referral ask gap

Business Name: `TEST R3: Referral ask gap`

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Retention |
| Sub-Path (Retention) | Referral ask gap |
| Field 2: Referral intros per month | 0 |

**Section 3 - Retention Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | % revenue from repeat | pick closest to 41-60% |
| 2 | % revenue from referrals | pick closest to 0-10% |
| 3 | Rebook/next-step scheduling | Sometimes |
| 4 | Reviews per month | 1-2 |
| 5 | Time to follow-up after service | 1-2 days |
| 6 | Customer check-in rhythm exists | Not sure |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Review + referral moment (timing + script + 2-step ask) |
| What we fix first | Increase referrals: install a simple ask and a weekly follow-up habit so intros become consistent. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Pick best moment to ask (end of service/after issue resolved). | Owner/GM | Day 7 |
| 2/6 | Create 2-step ask: review then introduction. | Admin/CSR | Day 7 |
| 3/6 | Train team on script (10 minutes). | Owner/GM | Day 21 |
| 4/6 | Weekly follow-up for 'yes' who didn't post. | Admin/CSR | Day 21 |
| 5/6 | Track reviews/week + referral intros/week; adjust timing/script. | Ops lead | Day 45 |
| 6/6 | Create one 'thank you' response pre-written message for referrals. | Admin/CSR | Day 45 |

**Section 6 - Metrics:** Reviews/week, Referral intros/week

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Referral ask gap".
**DOCX name:** R3_Referral-ask-gap_test.docx

---

### TEST R4: Post-service follow-up gap

Business Name: `TEST R4: Post-service follow-up gap`

**Section 2:**

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Retention |
| Sub-Path (Retention) | Post-service follow-up gap |
| Field 2: % revenue from repeat | pick closest to 0-10% |

**Section 3 - Retention Baselines:**

| # | Field | Value |
|---|-------|-------|
| 1 | % revenue from repeat | pick closest to 0-10% |
| 2 | % revenue from referrals | pick closest to 0-10% |
| 3 | Rebook/next-step scheduling | Rarely |
| 4 | Reviews per month | 0 |
| 5 | Time to follow-up after service | Not sure |
| 6 | Customer check-in rhythm exists | No |

**Section 4:**

| Field | Value |
|-------|-------|
| One Lever | Post-service check-in (30-day touch + simple template) |
| What we fix first | Install follow-up: add a simple check-in + next-step prompt so clients don't go silent after service. |

**Section 5 - Actions (from Action Ladder Reference v2):**

| Slot | Action (Plan-Ready) | Owner | Day |
|------|---------------------|-------|-----|
| 1/6 | Define what 'repeat' means + pick one follow-up trigger. | Owner/GM | Day 7 |
| 2/6 | Create 30-day check-in pre-written message (text/email). | Admin/CSR | Day 7 |
| 3/6 | Add 'next step' prompt at job end (maintenance/seasonal check). | Ops lead | Day 21 |
| 4/6 | Run light win-back message to past clients. | Admin/CSR | Day 21 |
| 5/6 | Track follow-up completion weekly; improve one bottleneck. | Ops lead | Day 45 |
| 6/6 | Standardize rebook ask script for techs/admin. | Ops lead | Day 45 |

**Section 6 - Metrics:** Rebook rate (or count), Days to follow-up after service, Repeat revenue band

**Expected:** Stop rules PASS. Confidence HIGH. DOCX generated with sub-path "Post-service follow-up gap".
**DOCX name:** R4_Post-service-followup-gap_test.docx

---

## MANUAL PATH TESTS (one per pillar)

For these tests, just fill Section 1 and Section 2, select "Other (manual)" as the sub-path, and submit. Skip baselines, actions, and metrics. The stop rule fires on the sub-path value before any of that gets checked.

---

### TEST M1: Acquisition, Other (manual)

Business Name: `TEST M1: Acquisition, Other (manual)`

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Acquisition |
| Sub-Path (Acquisition) | Other (manual) |

**Expected:** Stop rule FIRES. No DOCX generated. Email says "Manual plan required" with stop reason.

---

### TEST M2: Conversion, Other (manual)

Business Name: `TEST M2: Conversion, Other (manual)`

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Conversion |
| Sub-Path (Conversion) | Other (manual) |

**Expected:** Stop rule FIRES. No DOCX generated. "Manual plan required" email.

---

### TEST M3: Retention, Other (manual)

Business Name: `TEST M3: Retention, Other (manual)`

| Field | Value |
|-------|-------|
| Primary Gap from Quiz | Acquisition |
| Confirmed Primary Gap | Retention |
| Sub-Path (Retention) | Other (manual) |

**Expected:** Stop rule FIRES. No DOCX generated. "Manual plan required" email.

---

## CLAUDE CODE VERIFICATION PROMPTS

**For normal path tests (A1-A3, C1-C4, R1-R4):**

```
I just submitted a scan worksheet test for TESTID (SUBPATH). Quiz was Acquisition, scan confirmed GAP. Quiz fields in HubSpot will still show Acquisition, that's expected.

Verify the results:

1. Check HubSpot for contact tyler@bryantworks.com - check ALL mtg_ scan and plan fields including business name, gap, sub-path, confidence, lever, plan link, plan status.

2. Download the DOCX from mtg_plan_draft_link and:
   - Save it to ~/Downloads/Mind The Gaps Docx creation/FILENAME.docx
   - Verify it contains:
     * Business name: BUSINESSNAME
     * Primary gap: GAP
     * Sub-path: SUBPATH
     * Lever: LEVER
     * 6 actions present with correct text from Action Ladder Reference v2
     * Scorecard metrics: METRICS

Report: PASS or FAIL with details.
```

**For manual path tests (M1-M3), run once after all 3:**

```
I just submitted 3 manual path tests (Other/manual) for Acquisition, Conversion, and Retention. All used tyler@bryantworks.com. For each one the sub-path was "Other (manual)" which should trigger the stop rule.

Verify:

1. Check HubSpot for contact tyler@bryantworks.com - mtg_plan_draft_link should be empty or null, mtg_scan_sub_path should be "Other (manual)"

2. Check stop rules logic in workers/mtg-scan-webhook/src/stopRules.js to confirm "Other (manual)" is caught as a stop condition

3. Run: npm test

Report: PASS or FAIL for each.
```
