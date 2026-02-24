# MindtheGaps MVP Feedback — Implementation Checklist (FINAL v5)

**Repo:** `tylerFF/MindTheGaps`, `main` branch
**Source Documents:** 6 MVP Feedback documents from Marc:
- Implementation_Ticket_Jotform_Quiz_UX_MindtheGaps_v2_Clarified + Marc Notes
- Implementation_Ticket_Jotform_UX_MindtheGaps_v2_Clarified + Marc Notes
- Implementation_Ticket_One_Page_Plan_MindtheGaps_v2 + Marc Notes

---

## DECISIONS (LOCKED)

1. **Contradiction note:** Net-new field. Create in JotForm + backend.
2. **"Other (manual)" sub-path:** Generate a flagged draft. Write to HubSpot. Notify Marc. Do NOT send to customer.
3. **Action formatting:** Switch to appended text format per Marc's ticket. Each action is one line: "{action text} Owner: {role}. Due: Day {X}." Remove separate Owner and Due columns from the table.

---

## WORKSTREAM 1: JotForm Quiz UX (Form ID: 260466844433158)

**Scope:** Helper text and trust messaging only. Do NOT change question order, answer option labels/values, scoring weights, tie-breaks, branching, required vs optional status, results behavior, eligibility logic, or fix-first logic.

**Goal:** Reduce drop-off, lower hesitation around "Not sure" and contact fields, improve trust.

**Fallback rule:** If a field type does not support description text, place the helper text in the closest section text block immediately above that field.

### 1.1 — Intro Screen: Trust Strip
- [ ] Add trust text directly under the quiz intro/title (as Text element or intro description):
  > No logins. No customer lists. No sensitive uploads. Best estimates are fine.
- [ ] Add second line under trust strip:
  > Mostly quick picks and ranges. No essays.
- [ ] Keep visible without scrolling on mobile (1–2 short lines max)
- [ ] If space is tight, keep trust strip and drop the "no essays" line (not the other way around)

### 1.2 — Estimate/Range Questions: Helper Text
- [ ] Add field description/hint text on questions where users may hesitate:
  > Best estimate is fine. If you are not sure, choose 'Not sure.'
- [ ] Apply using Field Description / Hint text only — do NOT edit labels or options
- [ ] Apply to: V2, V3, V4, V5, A1, C1–C4, R1–R3 (all range/estimate questions)
- [ ] QA check: confirm "Not sure" option exists on all questions that should have it. If missing anywhere, flag it — do NOT add without spec check

### 1.3 — Profile Section: Support Text
- [ ] Add support line above optional contact fields (before Website and Phone, or as section text):
  > A few quick details so we can tailor your results and next steps.

### 1.4 — Website Field: Optional Helper
- [ ] Add field description on Website field (`q20_quiz_website`):
  > Optional. Helps us tailor your results. Skip if not handy.

### 1.5 — Phone Field: Optional Helper
- [ ] Add field description on Phone field (`q21_quiz_phone`):
  > Optional. Not required to get your results.

### 1.6 — Quiz UX Validation
- [ ] 1 full desktop test submission — helper text in correct places, optional fields submit blank
- [ ] 1 full mobile test submission — same checks, text readable without scrolling
- [ ] Confirm: no logic/flow behavior changed (question order, options, required fields, scoring, branching, results all unchanged)
- [ ] Confirm: Website and Phone fields still submit blank (remain optional)
- [ ] Any behavior that can't be confirmed in one pass: mark UNVERIFIED and note exact test path needed

---

## WORKSTREAM 2: JotForm Scan Worksheet UX (Form ID: 260435948553162)

**Scope:** Helper text, copy/paste aids, and one new field (contradiction note). Do NOT change existing logic, branching, conditional rules, or required flags.

**Goal:** Reduce facilitator typing + prevent "Missing Fields" by making required steps obvious. Target: Section 5 + 6 completable in <10 minutes using copy/paste.

**Fallback rule:** If a field type does not support description text, place the helper text in the closest section text block immediately above that field.

### 2.1 — Section 2B: Field 1 Helper Text
- [ ] Add under each Field 1 (sub-path) question (description/help text or Text element directly under):
  > Next screen is required: Field 2 tie-breaker for this choice.
  > NOT SURE rule: If you choose "not sure", select "Other (manual)" and a plan will NOT auto-generate.

### 2.2 — Section 2B: Field 2 Helper Text
- [ ] Add under each Field 2 (tie-breaker) question:
  > Pick the closest band. Don't debate.
  > If this contradicts Field 1, choose the best-fit sub-path and add a 1-line contradiction note (≤120 chars).

### 2.3 — NEW: Contradiction Note Field
- [ ] Create a new optional text field: "Contradiction note" (max 120 chars)
- [ ] Place in Section 2B, after the Field 2 tie-breaker questions
- [ ] Record the assigned QID — needed for Workstream 3 (item 3.4)

### 2.4 — Baseline Section: Minimum 5 Reminder
- [ ] Add at top of each gap's baseline block (Acquisition, Conversion, AND Retention):
  > Baseline reminder: Answer at least 5 baseline fields to generate a plan.
  > Pick the closest band. Don't debate. Keep moving.

### 2.5 — Section 5 Actions: Owner-Role Quick-Pick
- [ ] Add on EACH of the 6 Owner fields (`q42_action1Owner`, `q45_action2Owner`, `q48_action3Owner`, `q51_action4Owner`, `q54_action5Owner`, `q57_action6Owner`):
  > Owner-role quick-pick: Owner/GM • Ops lead • Admin/CSR • Marketing/Admin

### 2.6 — Section 5 Actions: Action Ladder Helper Blocks (10 total)
- [ ] Create ONE helper text block per sub-path (10 total)
- [ ] Show each block conditionally (only when that sub-path is selected in Field 1)
- [ ] Place each block ABOVE the 6 action slots (not beside each Owner field)
- [ ] Do NOT repeat the ladder beside each Owner field

**Exact ladder text for each sub-path (copy into helper blocks):**

#### H1) Acquisition — Not enough inbound demand
```
1/6 Define ONE clear offer + service area on one simple lead page (Owner/GM, Day 5).
2/6 Set weekly visibility cadence: 2 posts + 1 partner reach-out + 5 review asks (Marketing/Admin, Day 10).
3/6 Install review-ask script + timing rule; 10-minute team train (Ops lead, Day 18).
4/6 Add one secondary warm channel + intro script + weekly outreach list (Owner/GM, Day 25).
5/6 Weekly 15-minute scorecard review; adjust one thing (Owner/GM, Day 38).
6/6 Lightweight follow-up rule: same-day response + 2 follow-ups (Admin/CSR, Day 55).
```

#### H2) Acquisition — Leads aren't being captured
```
1/6 Choose ONE lead capture route (call/form/booking) and remove competing CTAs (Marketing/Admin, Day 4).
2/6 Set response owner + same-day SLA + short script (Owner/GM, Day 7).
3/6 Add immediate auto-confirm message for forms (Admin/CSR, Day 16).
4/6 Missed-call rule: return call within X hours + 2 follow-ups (Admin/CSR, Day 22).
5/6 Simple intake note format: problem/location/urgency (Admin/CSR, Day 40).
6/6 Weekly QA: sample 10 leads and confirm response met SLA (Owner/GM, Day 58).
```

#### H3) Acquisition — Too dependent on one channel
```
1/6 Name top source + risk band; pick ONE secondary channel (Owner/GM, Day 5).
2/6 Create weekly cadence for the secondary channel (Owner/GM, Day 10).
3/6 Partner intro script + 3-line blurb (Owner/GM, Day 18).
4/6 8–12 partner outreaches; track yes/no/maybe (Owner/GM, Day 28).
5/6 Install review-ask rhythm (Ops lead, Day 42).
6/6 Weekly scorecard: move dependence down one band (Owner/GM, Day 60).
```

#### I1) Conversion — Slow first response
```
1/6 Assign ONE lead owner + backup; SLA same day (Owner/GM, Day 3).
2/6 3-touch follow-up schedule (Day 0/2/5) with short templates (Admin/CSR, Day 10).
3/6 Immediate reply message for forms (Admin/CSR, Day 16).
4/6 Daily 10-minute lead review habit (Owner/GM, Day 22).
5/6 Track response time weekly; fix the biggest delay point (Owner/GM, Day 38).
6/6 Standardize first call script (3 questions + book next step) (Owner/GM, Day 55).
```

#### I2) Conversion — Hard to book soon
```
1/6 Choose ONE booking path (phone or link); remove extras (Owner/GM, Day 5).
2/6 Set booking expectations (next available + what's needed) (Admin/CSR, Day 10).
3/6 Confirmations + reminders (24h + 2h) with 'reply to confirm' (Admin/CSR, Day 18).
4/6 Pre-confirm checks: decision maker + address + access (Admin/CSR, Day 25).
5/6 Review time-to-first-appointment weekly; adjust blocks (Owner/GM, Day 40).
6/6 Waitlist / cancellation-fill rule (Admin/CSR, Day 58).
```

#### I3) Conversion — No-shows & reschedules
```
1/6 'What to expect' message (arrival window, length, prep) (Admin/CSR, Day 7).
2/6 Reminder sequence (24h + 2h) + easy reschedule rule (Admin/CSR, Day 10).
3/6 Short prep checklist (photos/measurements/decision maker) (Owner/GM, Day 18).
4/6 Day-before confirm: 'Are we still good for tomorrow?' (Admin/CSR, Day 25).
5/6 Track no-show reasons weekly and adjust (Owner/GM, Day 40).
6/6 Fill-the-gap process for same-day cancellations (Admin/CSR, Day 58).
```

#### I4) Conversion — Ghosting after quote
```
1/6 Quote turnaround SLA ≤48h + ownership (Owner/GM, Day 5).
2/6 3-step follow-up schedule (Day 2/5/10) templates (Admin/CSR, Day 10).
3/6 Quote walkthrough step (5 minutes) (Owner/GM, Day 18).
4/6 Decision-blocker question in follow-up (Admin/CSR, Day 25).
5/6 Track quote→close band weekly; review 3 lost deals (Owner/GM, Day 40).
6/6 Improve quote clarity with a simple standard template (Owner/GM, Day 58).
```

#### J1) Retention — Low repeats
```
1/6 Define what 'repeat' means + pick one follow-up trigger (Owner/GM, Day 7).
2/6 Create 30-day check-in template (text/email) (Admin/CSR, Day 10).
3/6 Add 'next step' prompt at job end (maintenance/seasonal check) (Ops lead, Day 18).
4/6 Run light win-back message to past clients (Admin/CSR, Day 25).
5/6 Track follow-up completion weekly; improve one bottleneck (Owner/GM, Day 40).
6/6 Standardize rebook ask script for techs/admin (Owner/GM, Day 58).
```

#### J2) Retention — Low referrals & reviews
```
1/6 Pick best moment to ask (end of service/after issue resolved) (Ops lead, Day 7).
2/6 Create 2-step ask: review then introduction (Owner/GM, Day 10).
3/6 Train team on script (10 minutes) (Owner/GM, Day 18).
4/6 Weekly follow-up for 'yes' who didn't post (Admin/CSR, Day 25).
5/6 Track reviews/week + referral intros/week; adjust timing/script (Owner/GM, Day 40).
6/6 Create one 'thank you' response template for referrals (Admin/CSR, Day 58).
```

#### J3) Retention — No rebook/recall system
```
1/6 Choose recall schedule (6m/12m etc.) (Owner/GM, Day 7).
2/6 Create rebook prompt at job end + script (Ops lead, Day 10).
3/6 Monthly recall reminder template (text/email) (Admin/CSR, Day 18).
4/6 'Next appointment scheduled' checkbox habit (Ops lead, Day 25).
5/6 Track rebook count weekly/monthly; fix biggest drop-off (Owner/GM, Day 40).
6/6 Light win-back for missed recall clients (Admin/CSR, Day 58).
```

### 2.7 — Section 6 Metrics: Helper Text
- [ ] Add ABOVE the metric picker for each gap (`q60_metricsConversion`, `q61_metricsAcquisition`, `q62_metricsRetention`). Exact text:

> Pick 2–4 metrics (minimum 2). Use exact labels:
>
> Conversion: Median response time • Lead→booked % • Show rate % • Quote sent within 48h %
>
> Acquisition: Leads/week • % leads from top source • Calls answered live % • Median response time • Reviews/week • Referral intros/week
>
> Retention: Rebook rate (or count) • Reviews/week • Referral intros/week • 30-day follow-up completion % • Repeat revenue band
>
> 30-day targets: choose the next better band. If baseline is "Not sure" → target = "Start tracking weekly".

### 2.8 — Pre-Submit: Completion Meter
- [ ] Add directly ABOVE the final Submit button:
  > To generate a plan, confirm:
  > ✓ Primary gap + sub-path + ONE lever selected
  > ✓ At least 5 baseline answers
  > ✓ All 6 action slots filled (Action + Owner + Due)
  > ✓ At least 2 metrics selected

### 2.9 — Open-Text Fields: Copy/Paste Templates
- [ ] Template beside **Update reason** (`q10_gapChangeReason`):
  > Update reason (≤200 chars): "Updated gap because {Field 2 band} contradicts the quiz."
- [ ] Template beside **Contradiction note** (new field from 2.3):
  > Contradiction note (≤120 chars): "Tie-breaker contradicts Field 1; choosing {sub-path} based on {Field 2 band}."
- [ ] Template beside **What we fix first** (`q39_oneLeverSentence`):
  > What we fix first (≤160 chars): paste the one-liner from the cheat sheet for the chosen sub-path.
- [ ] Template beside **Risk notes** (constraint fields `q64`, `q65`, `q66`):
  > Risk notes (optional): Busy season/capacity • Short-staffed • Tool sprawl • Budget constraints

### 2.10 — Scan Worksheet UX Validation
- [ ] 3 test submissions (Acquisition, Conversion, Retention) — no "Missing Fields"
- [ ] Confirm: Field 1 + Field 2 both completed (no misses)
- [ ] Confirm: ≥5 baseline answers filled
- [ ] Confirm: All 6 action slots filled (Action + Owner + Due)
- [ ] Confirm: ≥2 metrics selected
- [ ] Time Section 5 + Section 6 — target: <10 minutes combined using copy/paste

---

## WORKSTREAM 3: One-Page Plan Output

**Files:** `planGenerator.js`, `docxBuilder.js`, `stopRules.js`, `index.js`
**All in:** `workers/mtg-scan-webhook/src/`

**Goal:** Plan draft reads clean with minimal human edits. Uses only existing worksheet fields (no new data except contradiction note). Aligns with JotForm UX helpers: exact labels, copy/paste actions, Not sure handling.

### 3.1 — Plan Opener: Use "What We Fix First" Verbatim
**Current code:** `planGenerator.js` builds Section A from subPath + worst baseline. `oneLeverSentence` is wired to `sectionC.leverDescription`, NOT the opener.
- [ ] In `generatePlan()`: set `sectionA.opener` to `scanData.oneLeverSentence` verbatim
- [ ] Fallback (if blank): `"Fix {sub-path} first by focusing on {lever}."`
- [ ] In `buildSectionA()`: render opener as first prominent line after "What We Found" header
- [ ] Keep existing `supportingSignal` and `quizKeySignals` as secondary lines below

### 3.2 — Action Formatting: Append Owner + Due Inline
**Current code:** `docxBuilder.js` `buildSectionD()` renders actions in a 4-column table (#, Action, Owner, Timeline).
- [ ] Change to single-line format: each action combines description + owner + due
- [ ] Format: `"{action text} Owner: {role}. Due: Day {X}."`
- [ ] Keep one action per line. Keep it short.
- [ ] Do NOT reword action text — assume it was copy/pasted from the ladder
- [ ] If owner or due is empty, omit that part (don't show "Owner: . Due: .")
- [ ] Render as a numbered list or simple 2-column table (#, Full action line)

### 3.3 — "Not Sure" Handling
**Current code:** `getTarget()` returns `'Establish baseline'` when value is "Not sure".
- [ ] Change `getTarget()` return from `'Establish baseline'` to `'Start tracking weekly.'`
- [ ] In `buildSectionE()`: when a metric's target is `'Start tracking weekly.'`, add note line below it: `"This is a data gap. Track for 2 weeks, then tighten targets."`

### 3.4 — Contradiction Note (uses QID from Workstream 2, item 2.3)
**Current code:** No contradiction note field exists anywhere in the backend.
- [ ] Add contradiction note to `JOTFORM_SCAN_FIELD_MAP` in `index.js` (use QID from step 2.3)
- [ ] Add extraction in `extractScanData()`: `scan.contradictionNote = String(payload[field] || '').trim()`
- [ ] In `generatePlan()`: pass `scanData.contradictionNote` into `sectionA`
- [ ] In `buildSectionA()`: if contradiction note is present and non-empty, render one line: `"Why this focus: {contradiction note}"` — placed directly under the opener. If empty, render nothing.

### 3.5 — "Other (manual)" Sub-Path: Flagged Draft
**Current code:** `stopRules.js` `checkSubPath()` stops on BOTH "not sure" AND "Other (manual)".
- [ ] In `stopRules.js`: change "Other (manual)" from full stop to `{ rule: 'subpath_other', message: '...', degraded: true }` — NOT a full stop
- [ ] Keep "not sure" as a full stop (no change)
- [ ] In `index.js` `handleScanWebhook()`: add handling for `degraded: true` results:
  - Still run `calculateConfidence()`, `generatePlan()`, `buildDocx()`, `uploadPlan()`
  - Write ALL available fields to HubSpot
  - Set `mtg_plan_review_status = 'Manual Required'`
  - Set `mtg_plan_generation_mode = 'Degraded'`
  - Notify Marc with message: "Draft plan generated but sub-path was Other (manual). Human review required before sending to client."
  - Do NOT send to customer (plans are never auto-sent — this is already the case)
- [ ] In `planGenerator.js`: when `scanData.subPath` starts with "Other", add flag to plan content: `"Manual plan: sub-path was not selected with confidence. Human review required."`
- [ ] In `docxBuilder.js`: render that flag line visually prominent (bold or highlighted box) so Marc can't miss it during review
- [ ] Update affected stop rules tests

### 3.6 — Phrasing Bank
**Current code:** `buildInsights()` generates data-driven personalization. No sub-path-keyed phrases exist.
- [ ] Add `MOST_LIKELY_LEAK` lookup table in `planGenerator.js` (10 entries, exact text):

| Sub-Path | Phrase |
|----------|--------|
| Not enough inbound demand | "Inbound demand is not steady enough to hit targets." |
| Leads aren't being captured | "Leads are being lost at the capture/response step." |
| Too dependent on one channel | "Lead flow is concentrated in one source, which raises risk." |
| Slow first response | "Speed-to-lead is too slow, which reduces bookings." |
| Hard to book soon | "Booking is too slow or too hard, which reduces conversion." |
| No-shows & reschedules | "No-shows are reducing completed appointments." |
| Ghosting after quote | "Follow-up after quoting is not consistent, reducing close rate." |
| Low repeats | "There is no consistent post-service follow-up to drive repeat work." |
| Low referrals & reviews | "The ask is not happening at the best moment, so referrals/reviews stay low." |
| No rebook/recall system | "There is no reliable recall system to bring customers back." |

- [ ] Add `WHAT_CHANGES` lookup table (5 entries, exact text):
  - "More leads become booked work."
  - "More booked jobs actually show up."
  - "More quotes turn into signed work."
  - "More customers come back without new ad spend."
  - "More happy customers leave reviews and refer others."

- [ ] Wire both into `generatePlan()` Section A data (match sub-path for leak, match gap for "what changes")
- [ ] In `buildSectionA()`: render "Most likely leak: {text}" and "What changes if we fix it: {text}" after the opener

### 3.7 — Plan Output Validation
- [ ] Generate 3 test plans from A/C/R test submissions
- [ ] Confirm: opener is the "what we fix first" line (verbatim from worksheet)
- [ ] Confirm: metric labels match Section 6 labels exactly (no paraphrasing)
- [ ] Confirm: actions are NOT rewritten — formatted as one line with "Owner: {role}. Due: Day {X}." appended
- [ ] Confirm: "Not sure" → "Start tracking weekly." + "Track for 2 weeks, then tighten targets."
- [ ] Confirm: contradiction note appears as "Why this focus: {note}" only when present
- [ ] Confirm: "Other (manual)" produces a minimal draft, flags human review, writes to HubSpot, notifies Marc
- [ ] Confirm: phrasing bank "Most likely leak" + "What changes" lines appear per sub-path
- [ ] Human review time target: <10 minutes per plan

---

## PHASED IMPLEMENTATION PLAN

Each phase is one Claude Code session. Test after each phase before starting the next. Attach this entire checklist to each session so Claude Code has the full context.

---

### PHASE 1: Quiz UX (Workstream 1) — Est. 2–3 hours

#### Claude Code Prompt
```
Implement Phase 1 from the attached checklist (items 1.1–1.5). Add helper text to the
MindtheGaps quiz form (JotForm ID 260466844433158) using the JotForm API. The API key
will be passed as an environment variable JOTFORM_API_KEY.

Scope rules (CRITICAL — do not violate):
- Do NOT change question order, answer options, scoring, branching, or required/optional status
- ONLY add description/help text and Text elements
- If a field type does not support description text, place the helper text in the closest
  section text block immediately above that field

After making changes, list every field you modified and what text was added so I can verify.
```

#### Test Script: Phase 1

**Test 1A — Desktop Submission**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open quiz link on desktop browser | Quiz loads, intro screen visible |
| 2 | Check intro screen | Trust strip visible: "No logins. No customer lists. No sensitive uploads. Best estimates are fine." Second line: "Mostly quick picks and ranges. No essays." |
| 3 | Navigate to V2 (leads per month) | Helper text visible: "Best estimate is fine. If you are not sure, choose 'Not sure.'" |
| 4 | Navigate through V3, V4, V5 | Same helper text on each range/estimate question |
| 5 | Navigate to A1, C1–C4, R1–R3 | Same helper text on each range/estimate question |
| 6 | Check each question with "Not sure" option | "Not sure" option exists in answer list (do not add if missing — flag it) |
| 7 | Navigate to profile section | Support text visible: "A few quick details so we can tailor your results and next steps." |
| 8 | Check Website field | Helper text visible: "Optional. Helps us tailor your results. Skip if not handy." |
| 9 | Check Phone field | Helper text visible: "Optional. Not required to get your results." |
| 10 | Leave Website and Phone blank, fill all required fields, submit | Quiz submits successfully. Results page loads. No errors. |
| 11 | Check results page | Primary gap displayed. Score displayed. No change from pre-Phase 1 behavior. |

**Test 1B — Mobile Submission**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open quiz link on mobile (or mobile emulator) | Quiz loads |
| 2 | Check intro screen | Trust strip visible without scrolling. Text is 1–2 short lines. |
| 3 | Navigate through all questions | Helper text readable, not cut off, doesn't require horizontal scroll |
| 4 | Leave Website and Phone blank, submit | Quiz submits. Results page loads. |

**Phase 1 Pass Criteria:**
- [ ] All helper text appears in correct locations (desktop)
- [ ] All helper text readable on mobile without scrolling
- [ ] Website and Phone fields still submit blank (optional status unchanged)
- [ ] Question order unchanged from pre-Phase 1
- [ ] Answer options unchanged from pre-Phase 1
- [ ] Results page behavior unchanged from pre-Phase 1
- [ ] No new required fields introduced

---

### PHASE 2: Scan Worksheet UX — Helper Text (Workstream 2 minus 2.3) — Est. 6–8 hours

#### Claude Code Prompt
```
Implement Phase 2 from the attached checklist (items 2.1–2.2, 2.4–2.9). Add helper text,
action ladders, owner quick-picks, metric helpers, completion meter, and copy/paste
templates to the MindtheGaps scan worksheet (JotForm ID 260435948553162) using the
JotForm API. The API key will be passed as an environment variable JOTFORM_API_KEY.

Key rules:
- Do NOT change existing logic, branching, conditional rules, or required flags
- The 10 action ladder blocks (H1-H3, I1-I4, J1-J3) must be conditional — each
  shows ONLY when its sub-path is selected in Field 1
- Place each ladder block ABOVE the 6 action slots, not beside each Owner field
- Owner-role quick-pick goes on EACH of the 6 Owner fields (not just once)
- Do NOT create the contradiction note field — that's Phase 3

The exact text for all helpers and all 10 ladder blocks is in the attached checklist
(items 2.1–2.9). Use it verbatim.

After making changes, list every field/element you added or modified.
```

#### Test Script: Phase 2

**Test 2A — Acquisition Path**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open scan worksheet, fill Section 1 (metadata) | Form loads, fields work |
| 2 | Select Primary Gap = Acquisition | Acquisition sub-path options appear |
| 3 | Check Field 1 helper text | "Next screen is required: Field 2 tie-breaker for this choice." + NOT SURE rule visible |
| 4 | Select sub-path = "Not enough inbound demand" | Field 2 tie-breaker appears |
| 5 | Check Field 2 helper text | "Pick the closest band. Don't debate." + contradiction note instruction visible |
| 6 | Fill Field 2, navigate to baseline section | Baseline section loads |
| 7 | Check baseline helper | "Baseline reminder: Answer at least 5 baseline fields..." visible at top |
| 8 | Fill ≥5 baseline fields | Baseline section complete |
| 9 | Navigate to Section 5 (Actions) | Action section loads |
| 10 | Check for action ladder | H1 ladder text visible ABOVE action slots: "1/6 Define ONE clear offer..." through "6/6 Lightweight follow-up rule..." |
| 11 | Check all 6 Owner fields | Each has quick-pick text: "Owner/GM • Ops lead • Admin/CSR • Marketing/Admin" |
| 12 | Copy/paste from ladder into 6 action slots + owners + due dates | All 6 filled using copy/paste from ladder. Time this step. |
| 13 | Navigate to Section 6 (Metrics) | Metric section loads |
| 14 | Check metric helper text | "Pick 2–4 metrics (minimum 2). Use exact labels:" + Acquisition labels listed + 30-day target rule |
| 15 | Select ≥2 metrics, fill baselines + targets | Metrics complete |
| 16 | Navigate to pre-submit | Completion meter visible: "✓ Primary gap + sub-path..." checklist |
| 17 | Check open-text templates | Update reason, What we fix first, Risk notes all have template text |
| 18 | Submit | Form submits. No "Missing Fields" error. |

**Test 2B — Conversion Path**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | New submission. Select Primary Gap = Conversion | Conversion sub-path options appear |
| 2 | Select sub-path = "Slow first response" | Field 2 appears |
| 3 | Fill Field 2, baseline (≥5), navigate to Section 5 | I1 ladder text visible (NOT H1) |
| 4 | Confirm H1/H2/H3 ladders are NOT showing | Only the selected sub-path's ladder is visible |
| 5 | Copy/paste from I1 ladder, fill 6 actions + owners + due dates | Complete |
| 6 | Select ≥2 Conversion metrics | Metric labels match: "Median response time • Lead→booked % • Show rate % • Quote sent within 48h %" |
| 7 | Submit | No "Missing Fields" error |

**Test 2C — Retention Path**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | New submission. Select Primary Gap = Retention | Retention sub-path options appear |
| 2 | Select sub-path = "Low referrals & reviews" | Field 2 appears |
| 3 | Fill Field 2, baseline (≥5), navigate to Section 5 | J2 ladder text visible |
| 4 | Copy/paste from J2 ladder, fill 6 actions | Complete |
| 5 | Select ≥2 Retention metrics | Labels match spec |
| 6 | Submit | No "Missing Fields" error |

**Test 2D — Timing**

| Metric | Target | Actual |
|--------|--------|--------|
| Section 5 completion time (using copy/paste from ladder) | <5 min | _____ |
| Section 6 completion time | <5 min | _____ |
| Section 5 + 6 combined | <10 min | _____ |

**Phase 2 Pass Criteria:**
- [ ] 3 test submissions (A/C/R) complete with NO "Missing Fields"
- [ ] Field 1 + Field 2 helper text visible in all 3 paths
- [ ] Correct ladder shows for selected sub-path (wrong ladders hidden)
- [ ] Owner quick-pick text on all 6 Owner fields
- [ ] Metric helper text with correct labels per gap
- [ ] Completion meter visible before Submit
- [ ] Open-text templates visible
- [ ] Section 5 + 6 combined time <10 minutes
- [ ] No existing logic, branching, or required flags changed

---

### PHASE 3: Contradiction Note Field (Workstream 2, item 2.3) — Est. 30 min

#### Claude Code Prompt
```
Implement Phase 3 from the attached checklist (item 2.3 only). Create a new optional text
field called "Contradiction note" in the MindtheGaps scan worksheet (JotForm ID
260435948553162) using the JotForm API. The API key will be passed as an environment
variable JOTFORM_API_KEY.

Requirements:
- Field label: "Contradiction note"
- Max length: 120 characters
- Required: No (optional)
- Placement: Section 2B, after the Field 2 tie-breaker questions
- Add helper text: 'Contradiction note (≤120 chars): "Tie-breaker contradicts Field 1;
  choosing {sub-path} based on {Field 2 band}."'

CRITICAL: Report back the exact QID that JotForm assigns to this new field. I need it
for Phase 5 (backend wiring). Format: qXX_fieldName
```

#### Test Script: Phase 3

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open scan worksheet, navigate to Section 2B | Section loads |
| 2 | Select any sub-path in Field 1 | Field 2 appears |
| 3 | Fill Field 2 | Contradiction note field appears after Field 2 |
| 4 | Check field properties | Field is optional (not required). Has helper text. |
| 5 | Enter text >120 chars | Field enforces max length (or helper text indicates limit) |
| 6 | Enter text ≤120 chars and submit form | Form submits. Note field value visible in JotForm submissions. |
| 7 | Record QID | QID = q______ (record this for Phase 5) |

**Phase 3 Pass Criteria:**
- [ ] Contradiction note field exists in Section 2B after Field 2
- [ ] Field is optional
- [ ] Helper text / template visible
- [ ] QID recorded: __________

---

### PHASE 4: Plan Output — Safe Changes (Workstream 3, items 3.1–3.3, 3.6) — Est. 4–5 hours

#### Claude Code Prompt
```
Implement Phase 4 from the attached checklist (items 3.1, 3.2, 3.3, 3.6). Work in the
tylerFF/MindTheGaps repo, main branch. All files are in workers/mtg-scan-webhook/src/.

Changes to make:
1. (3.1) Rewire plan opener: use scanData.oneLeverSentence verbatim as sectionA.opener.
   Fallback if blank: "Fix {sub-path} first by focusing on {lever}."
   Currently oneLeverSentence goes to sectionC.leverDescription — move it to sectionA.

2. (3.2) Change action formatting in docxBuilder.js buildSectionD(): switch from 4-column
   table (#, Action, Owner, Timeline) to single-line format. Each action is:
   "{action text} Owner: {role}. Due: Day {X}."
   Do NOT reword action text. If owner or due is empty, omit that part.

3. (3.3) Change "Not sure" target text: in getTarget(), change return from
   'Establish baseline' to 'Start tracking weekly.' In buildSectionE(), when target is
   'Start tracking weekly.', add note: "This is a data gap. Track for 2 weeks, then
   tighten targets."

4. (3.6) Add phrasing bank: MOST_LIKELY_LEAK lookup (10 entries by sub-path) and
   WHAT_CHANGES lookup (5 entries by gap type). Wire into Section A.
   Exact text is in the attached checklist.

After changes, run the existing test suite. Fix any failures. Then list all files changed
and what was modified.
```

#### Test Script: Phase 4

**Test 4A — Unit Tests**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `npm test` from workers/mtg-scan-webhook | All existing tests pass (or updated tests pass) |
| 2 | Check for new test failures | 0 failures. If any tests were updated, the changes are documented. |

**Test 4B — Acquisition Plan**

| Check | Expected Result |
|-------|-----------------|
| Plan opener (Section A, first line) | Contains the exact `oneLeverSentence` text from the test submission (not the subPath-derived text) |
| Fallback test: submit with blank oneLeverSentence | Opener reads "Fix {sub-path} first by focusing on {lever}." |
| "Most likely leak" line | Appears in Section A. Text matches MOST_LIKELY_LEAK for the selected sub-path. |
| "What changes" line | Appears in Section A. Text matches WHAT_CHANGES for Acquisition gap. |
| Action formatting | Each action is ONE line: "{text} Owner: {role}. Due: Day {X}." — NOT a multi-column table |
| Metric with "Not sure" baseline | Target reads "Start tracking weekly." with note "This is a data gap. Track for 2 weeks, then tighten targets." |
| Metric with known baseline | Target reads next-better band (NOT "Start tracking weekly") — no data gap note |

**Test 4C — Conversion Plan**

| Check | Expected Result |
|-------|-----------------|
| "Most likely leak" | Matches Conversion sub-path (e.g., "Speed-to-lead is too slow..." for Slow first response) |
| "What changes" | Matches Conversion gap |
| Actions | Inline format with Owner + Due appended |

**Test 4D — Retention Plan**

| Check | Expected Result |
|-------|-----------------|
| "Most likely leak" | Matches Retention sub-path |
| "What changes" | Matches Retention gap |
| All 6 actions present | Each formatted as single line with Owner + Due |

**Phase 4 Pass Criteria:**
- [ ] All unit tests pass
- [ ] 3 plans generated (A/C/R) with correct opener (verbatim oneLeverSentence)
- [ ] Phrasing bank phrases appear in all 3 plans (correct per sub-path and gap)
- [ ] Actions formatted as single lines with "Owner: {role}. Due: Day {X}." appended
- [ ] "Not sure" metrics show "Start tracking weekly." + 2-week note
- [ ] Known-baseline metrics show next-better band (no change from current correct behavior)

---

### PHASE 5: Plan Output — Behavioral Changes (Workstream 3, items 3.4–3.5) — Est. 4–6 hours

#### Claude Code Prompt
```
Implement Phase 5 from the attached checklist (items 3.4 and 3.5). Work in the
tylerFF/MindTheGaps repo, main branch. All files are in workers/mtg-scan-webhook/src/.

IMPORTANT: The contradiction note field QID from Phase 3 is: [PASTE QID HERE]

Changes to make:
1. (3.4) Wire contradiction note into backend:
   - Add to JOTFORM_SCAN_FIELD_MAP in index.js using the QID above
   - Extract in extractScanData(): scan.contradictionNote
   - Pass to generatePlan() sectionA
   - In buildSectionA(): if non-empty, render "Why this focus: {note}" under opener.
     If empty, render nothing.

2. (3.5) Change "Other (manual)" from full stop to degraded draft:
   - In stopRules.js: change "Other (manual)" to return { degraded: true } instead of
     full stop. Keep "not sure" as a full stop (no change).
   - In index.js handleScanWebhook(): when result has degraded: true, STILL generate
     the plan (calculateConfidence, generatePlan, buildDocx, uploadPlan). Write ALL
     fields to HubSpot. Set mtg_plan_review_status = 'Manual Required' and
     mtg_plan_generation_mode = 'Degraded'. Notify Marc that human review is required.
     Do NOT send plan to customer (plans are never auto-sent anyway).
   - In planGenerator.js: when subPath starts with "Other", add flag:
     "Manual plan: sub-path was not selected with confidence. Human review required."
   - In docxBuilder.js: render that flag line visually prominent (bold or highlighted).

After changes, run the full test suite. Fix any failures. Then list all files changed.
```

#### Test Script: Phase 5

**Test 5A — Contradiction Note Present**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit scan worksheet with contradiction note: "Tie-breaker contradicts Field 1; choosing Slow first response based on Same day band." | Submission succeeds |
| 2 | Wait for plan generation | Plan DOCX is generated |
| 3 | Open generated plan, check Section A | Line appears: "Why this focus: Tie-breaker contradicts Field 1; choosing Slow first response based on Same day band." |
| 4 | Line is placed directly under the opener | Correct placement |

**Test 5B — Contradiction Note Empty**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit scan worksheet with NO contradiction note (field left blank) | Submission succeeds |
| 2 | Open generated plan, check Section A | NO "Why this focus:" line appears. Opener goes directly to phrasing bank lines. |

**Test 5C — "Other (manual)" Sub-Path**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit scan worksheet with sub-path = "Other (manual)" | Submission succeeds (does NOT stop/block) |
| 2 | Check plan generation | Plan DOCX IS generated (not blocked) |
| 3 | Open plan | Flag visible: "Manual plan: sub-path was not selected with confidence. Human review required." — bold or highlighted |
| 4 | Check HubSpot contact record | All scan fields written. `mtg_plan_review_status` = "Manual Required". `mtg_plan_generation_mode` = "Degraded". |
| 5 | Check Marc notification | Email/notification received: "Draft plan generated but sub-path was Other (manual). Human review required before sending to client." |
| 6 | Confirm plan NOT sent to customer | No customer-facing email sent. Plan only accessible to Marc via R2 link. |

**Test 5D — "Not sure" Sub-Path (Regression — should still be a full stop)**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit scan worksheet with sub-path = "not sure" | Submission succeeds |
| 2 | Check plan generation | Plan is NOT generated (full stop still in effect) |
| 3 | Check HubSpot | Stop reason recorded. Marc notified. |

**Test 5E — Unit Tests**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `npm test` from workers/mtg-scan-webhook | All tests pass |

**Phase 5 Pass Criteria:**
- [ ] Contradiction note renders in plan when present
- [ ] Contradiction note line omitted when field is empty
- [ ] "Other (manual)" generates a degraded draft plan (NOT blocked)
- [ ] "Other (manual)" plan has prominent "Manual plan" flag
- [ ] "Other (manual)" writes all fields to HubSpot with Manual Required + Degraded statuses
- [ ] "Other (manual)" triggers Marc notification
- [ ] "Other (manual)" does NOT send plan to customer
- [ ] "not sure" sub-path is STILL a full stop (regression check)
- [ ] All unit tests pass

---

## SUMMARY

| Phase | Scope | Risk | Est. Hours |
|-------|-------|------|-----------|
| 1 | Quiz UX helper text | Low | 2–3 |
| 2 | Scan worksheet helper text + ladders | Low | 6–8 |
| 3 | New contradiction note field | Low | 0.5 |
| 4 | Plan output safe changes | Medium | 4–5 |
| 5 | Plan output behavioral changes | Higher | 4–6 |
| | **Total** | | **~17–23 hrs** |

Each phase = one Claude Code session with a clear prompt, a clear test, and a clear "done" definition.
