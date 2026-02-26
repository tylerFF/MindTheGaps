# MindtheGaps MVP Feedback — Updated Implementation Status (v6)

**Generated:** 2026-02-26
**Repo:** `tylerFF/MindTheGaps`, `main` branch
**Source:** `MindtheGaps_MVP_Feedback_Implementation_Checklist_FINAL_v5.md`
**Test baseline:** 501 tests passing, 0 failures (was 473 before Field 2 work)
**JotForm verification:** Both forms queried via JotForm API on 2026-02-26
**Field 2 follow-up:** 10 new JotForm fields + code wiring completed 2026-02-26

---

## STATUS SUMMARY

| Workstream | Scope | Status | Notes |
|---|---|---|---|
| **1: JotForm Quiz UX** | Helper text on quiz form | ✅ **5 of 6 items COMPLETE** | Only 1.6 (manual validation) remaining |
| **2: JotForm Scan Worksheet UX** | Helper text + contradiction note field + Field 2 follow-ups | ✅ **9 of 10 items COMPLETE** | Only 2.10 (manual validation) remaining |
| **3: One-Page Plan Output** | Code changes in `workers/mtg-scan-webhook/src/` | ✅ **6 of 7 items COMPLETE** | Only 3.7 (manual validation) remaining |

**Bottom line:** All automatable work is done. The only remaining items across all 3 workstreams are manual validation tests (1.6, 2.10, 3.7).

---

## WORKSTREAM 1: JotForm Quiz UX — ✅ 5 OF 6 COMPLETE

**Form ID:** 260466844433158
**Verified:** JotForm API query confirmed all helper text is live on the form.

| Item | Description | Status | Verification |
|---|---|---|---|
| 1.1 | Intro Screen: Trust Strip | ✅ Complete | QID 1 subHeader contains trust strip text |
| 1.2 | Estimate/Range Questions: Helper Text | ✅ Complete | QIDs 39-50: helper text elements for V2-V5, A1, C1-C4, R1-R3 |
| 1.3 | Profile Section: Support Text | ✅ Complete | QID 13 subHeader contains support text |
| 1.4 | Website Field: Optional Helper | ✅ Complete | QID 20 subLabel: "(Optional) Helps us tailor your results. Skip if not handy." |
| 1.5 | Phone Field: Optional Helper | ✅ Complete | QID 21 subLabel: "(Optional) Not required to get your results." |
| 1.6 | Quiz UX Validation (desktop + mobile) | ❌ Not started | **Manual test required** |

---

## WORKSTREAM 2: JotForm Scan Worksheet UX — ✅ 8 OF 10 COMPLETE

**Form ID:** 260435948553162
**Verified:** JotForm API query confirmed all fields, helper text, conditional visibility rules, and the contradiction note field are live on the form. 28 form-level conditions control visibility.

| Item | Description | Status | Verification |
|---|---|---|---|
| 2.1 | Section 2B: Field 1 Helper Text | ✅ Complete | QIDs 11-13 (sub-path dropdowns) have helper text in description fields |
| 2.2 | Section 2B: Field 2 Follow-Up Questions | ✅ Complete | 10 dropdown fields (QIDs 80-89), conditional visibility, "Not sure" → full stop rule, plan rendering, 28 new tests |
| 2.3 | **NEW: Contradiction Note Field** | ✅ Complete | QID 79: textbox field with template description, optional |
| 2.4 | Baseline Section: Minimum 5 Reminder | ✅ Complete | QID 14 subHeader updated to spec text: "Baseline reminder: Answer at least 5 baseline fields to generate a plan. Pick the closest band. Don't debate. Keep moving." |
| 2.5 | Section 5 Actions: Owner-Role Quick-Pick | ✅ Complete | QIDs 42,45,48,51,54,57: owner fields have quick-pick description text |
| 2.6 | Section 5 Actions: Action Ladder Helper Blocks (10 total) | ✅ Complete | QIDs 69-78: 10 ladder text blocks with full conditional visibility based on sub-path selection |
| 2.7 | Section 6 Metrics: Helper Text | ✅ Complete | QIDs 60-62: metrics checkbox fields have per-pillar helper descriptions |
| 2.8 | Pre-Submit: Completion Meter | ✅ Complete | QID 68: completion meter text element |
| 2.9 | Open-Text Fields: Copy/Paste Templates | ✅ Complete | QIDs 10,39,64-66: copy/paste templates in description fields |
| 2.10 | Scan Worksheet UX Validation (3 test submissions) | ❌ Not started | **Manual test required** (A/C/R paths) |

**QID 79 confirmed:** The contradiction note field was assigned QID 79 by JotForm, which matches the code in `index.js`. No code change was needed — the "placeholder" turned out to be the actual QID. Comment in `index.js` updated to reflect this.

---

## WORKSTREAM 3: One-Page Plan Output — ✅ 6 OF 7 COMPLETE

**Files:** `workers/mtg-scan-webhook/src/` — `planGenerator.js`, `docxBuilder.js`, `stopRules.js`, `index.js`, `notifications.js`
**Tests:** 473 passing, 0 failures

### ✅ 3.1 — Plan Opener: Use "What We Fix First" Verbatim — COMPLETE

**What was done:**
- `generatePlan()` sets `sectionA.opener` to `scanData.oneLeverSentence` verbatim
- Fallback when blank: `"Fix {sub-path} first by focusing on {lever}."`
- `buildSectionA()` renders opener as first prominent line after "What We Found" header
- `sectionC.leverDescription` cleared (moved to opener)
- Existing `supportingSignal` and `quizKeySignals` remain as secondary lines below

**Tests added:** 4 tests in `planGenerator.test.js` (opener verbatim, fallback, empty, leverDescription cleared)
**Tests added:** 3 tests in `docxBuilder.test.js` (render with opener, empty opener, undefined opener)

---

### ✅ 3.2 — Action Formatting: Append Owner + Due Inline — COMPLETE

**What was done:**
- `buildSectionD()` changed from 4-column table (#, Action, Owner, Timeline) to 2-column table (#, Action)
- Each action rendered as: `"{action text} Owner: {role}. Due: Day {X}."`
- Owner/Due parts omitted when empty (no "Owner: . Due: .")
- Action text is NOT reworded (passed through verbatim)

**Tests added:** 4 tests in `docxBuilder.test.js` (inline format, omit empty owner, omit empty due, empty actions)

---

### ✅ 3.3 — "Not Sure" Handling — COMPLETE

**What was done:**
- `getTarget()` returns `'Start tracking weekly.'` (was `'Establish baseline'`) for "Not sure", null, and empty values
- `buildSectionE()` adds note paragraph when any metric target is `'Start tracking weekly.'`:
  > "This is a data gap. Track for 2 weeks, then tighten targets."

**Tests added:** 4 tests in `planGenerator.test.js` (null, empty, case-insensitive, known values NOT affected)
**Tests added:** 3 tests in `docxBuilder.test.js` (data gap note present, absent, all metrics)

---

### ✅ 3.4 — Contradiction Note — COMPLETE

**What was done:**
- `JOTFORM_SCAN_FIELD_MAP` in `index.js`: `q79_contradictionNote: 'contradictionNote'`
- QID 79 confirmed via JotForm API — matches the actual field assignment (no longer a placeholder)
- `extractScanData()`: extracts and defaults to empty string
- `generatePlan()`: passes `scanData.contradictionNote` (trimmed) into `sectionA`
- `buildSectionA()`: renders "Why this focus: {note}" in italic, placed directly under opener; renders nothing if empty

**Tests added:** 4 tests in `planGenerator.test.js` (present, absent, empty, whitespace trimming)
**Tests added:** 4 tests in `docxBuilder.test.js` (renders when present, hidden when empty/undefined, placement order)
**Tests added:** 3 tests in `scanWebhook.test.js` (extraction, default, trimming)

---

### ✅ 3.5 — "Other (manual)" Sub-Path: Flagged Draft — COMPLETE

**What was done:**

**stopRules.js:**
- `checkSubPath()`: "Other (manual)" returns `{ rule: 'subpath_other', degraded: true }` instead of full stop
- "Not sure" remains a full stop (no change)
- `checkStopRules()`: separates full stops from degraded results
- Return shape now includes `degraded: boolean` field
- Key logic: `degraded = hasDegraded && fullStops.length === 0` (if any full stop fires alongside, `degraded` is false)

**index.js:**
- Computes `isDegraded = stopResult.degraded && !stopResult.stopped`
- Degraded plans still go through the full pipeline (confidence → plan → DOCX → R2 → HubSpot)
- HubSpot: `mtg_plan_review_status = 'Manual Required'`, `mtg_plan_generation_mode = 'Degraded'`
- Uses `notifyDegradedPlan()` instead of `notifyPlanReady()` for degraded plans
- Response includes `degraded: isDegraded` field

**planGenerator.js:**
- When `scanData.subPath` starts with "Other": sets `manualPlanFlag = 'Manual plan: sub-path was not selected with confidence. Human review required.'`
- When normal sub-path: `manualPlanFlag = ''`

**docxBuilder.js:**
- Renders manual plan flag in bold red (#CC0000) on yellow (#FFF3CD) background — most prominent position (before opener)

**notifications.js:**
- Added `buildDegradedPlanEmail()` and `notifyDegradedPlan()` function
- Degraded notification message: "Draft plan generated but sub-path was Other (manual). Human review required before sending to client."

**Tests added:** 10 tests in `stopRules.test.js` (degraded behavior, combined with full stops, regression check)
**Tests added:** 8 tests in `planGenerator.test.js` (manual flag for Other variants, normal paths, empty, Not sure)
**Tests added:** 4 tests in `docxBuilder.test.js` (flag rendering, absence, placement)
**Tests added:** 5 tests in `scanWebhook.test.js` (degraded HubSpot properties, handler end-to-end, regression check)

---

### ✅ 3.6 — Phrasing Bank — COMPLETE

**What was done:**
- Added `MOST_LIKELY_LEAK` lookup table in `planGenerator.js` (10 entries keyed by actual JotForm dropdown values)
- Added `WHAT_CHANGES` lookup table (keyed by sub-path, with gap-level fallbacks via `WHAT_CHANGES_BY_GAP`)
- Both wired into `generatePlan()` → `sectionA.mostLikelyLeak` and `sectionA.whatChanges`
- `buildSectionA()` renders:
  - "Most likely leak: {text}" (bold label + normal text)
  - "What changes if we fix it: {text}" (bold label + normal text)
  - Both placed after opener (and contradiction note if present), before "Primary Growth Gap" line

**Tests added:** 10+ tests in `planGenerator.test.js` (all sub-paths, all pillars, fallback behavior, unknown sub-paths)
**Tests added:** 5 tests in `docxBuilder.test.js` (render presence/absence, combined rendering)

---

### ❌ 3.7 — Plan Output Validation — NOT STARTED

**Blocked by:** Requires running 3 end-to-end test plans through the live system (not unit-testable).

**Validation checklist (from FINAL v5):**
- [ ] Generate 3 test plans from A/C/R test submissions
- [ ] Confirm: opener is the "what we fix first" line (verbatim from worksheet)
- [ ] Confirm: metric labels match Section 6 labels exactly
- [ ] Confirm: actions are NOT rewritten — formatted as one line with "Owner: {role}. Due: Day {X}." appended
- [ ] Confirm: "Not sure" → "Start tracking weekly." + "Track for 2 weeks, then tighten targets."
- [ ] Confirm: contradiction note appears as "Why this focus: {note}" only when present
- [ ] Confirm: "Other (manual)" produces a minimal draft, flags human review, writes to HubSpot, notifies Marc
- [ ] Confirm: phrasing bank "Most likely leak" + "What changes" lines appear per sub-path
- [ ] Human review time target: <10 minutes per plan

**Can be done once:** Workers are deployed to Cloudflare + a test scan worksheet submission is pushed through.

---

## WHAT'S LEFT — ONLY MANUAL VALIDATION

All automatable work (code changes + JotForm configuration) is complete. The only remaining items require manual testing through the live system:

| Item | What | Prerequisites |
|---|---|---|
| **1.6** | Quiz UX Validation | Open quiz form on desktop + mobile, verify all helper text displays correctly |
| **2.10** | Scan Worksheet UX Validation | Submit 3 test scans (A/C/R paths), verify helper text, ladders, completion meter, templates |
| **3.7** | Plan Output Validation | Deploy scan webhook to Cloudflare, run 3 end-to-end test submissions, verify DOCX output |

**Recommended order:**
1. Items 1.6 and 2.10 can be done immediately (forms are live)
2. Item 3.7 requires deploying the scan webhook worker to Cloudflare first

---

## SMALL FIXES APPLIED DURING EARLIER REVIEW

1. **`tests/scanTestCases.js`** — Added `oneLeverSentence` and `contradictionNote` as overridable default fields in `buildScanData()`. Previously these fields were missing from the test fixture (tests set them manually), now they default to `''` for consistency with the actual `extractScanData()` output. Zero test impact (473 still pass).

2. **`workers/mtg-scan-webhook/src/docxBuilder.js`** — Fixed stale JSDoc: changed `"from Claude API"` to `"from planGenerator"` since plan generation is now fully deterministic (no AI calls). Zero functional impact.

3. **`workers/mtg-scan-webhook/src/index.js`** — Updated comment on contradiction note QID from placeholder language to confirmed: "QID 79 confirmed in JotForm scan worksheet".

4. **JotForm Scan Worksheet QID 14** — Updated baseline section subHeader to full spec text: "Baseline reminder: Answer at least 5 baseline fields to generate a plan. Pick the closest band. Don't debate. Keep moving."

---

## ITEM 2.2: FIELD 2 FOLLOW-UP QUESTIONS — IMPLEMENTATION DETAILS

**Spec source:** `docs/Marc MVP Feedback Docs/Field2_Follow-Up_Spec_Marc.md`
**Tests:** 501 passing (+28 new), 0 failures

### What was done:

**JotForm (Form 260435948553162):**
- Created 10 new `control_dropdown` fields (QIDs 80-89), one per sub-path
- Each field has 4-5 range options plus "Not sure"
- 28 conditional visibility rules updated: each Field 2 shows only when its sub-path is selected
- Pillar-level conditions updated to hide cross-pillar Field 2 fields
- 3 sub-paths have no Field 2 (Fit mismatch, Referral/partner flow, Review rhythm gap)

**index.js:**
- Added `field2BySubPath` to `JOTFORM_SCAN_FIELD_MAP` (10 entries keyed by sub-path value → field name + label)
- Registered Field 2 QIDs in `QID_TO_FIELD` for numeric key resolution
- `extractScanData()` extracts `field2Answer` and `field2Label` based on selected sub-path
- `buildHubSpotProperties()` writes `mtg_scan_field2_answer` to HubSpot when present

**stopRules.js:**
- Added `checkField2NotSure()` — returns full stop when `field2Answer` is "Not sure"
- Wired into `checkStopRules()` between sub-path check and gap-change check
- Per Marc: "do not auto-generate the plan" when Field 2 is "Not sure"

**planGenerator.js:**
- Passes `field2Answer` and `field2Label` through to `sectionA`

**docxBuilder.js:**
- Renders "Sub-path confirmation: {label}: {answer}" in Section A (between phrasing bank and Primary Growth Gap line)
- Hidden when `field2Answer` or `field2Label` is empty

**scanTestCases.js:**
- Added `field2Answer` and `field2Label` as overridable defaults in `buildScanData()`

### Tests added:
- **stopRules.test.js:** 9 tests (checkField2NotSure unit tests, checkStopRules integration)
- **scanWebhook.test.js:** 10 tests (extraction per pillar, handler stop behavior, HubSpot properties)
- **planGenerator.test.js:** 4 tests (passthrough, empty, trimming, defaults)
- **docxBuilder.test.js:** 5 tests (rendering presence/absence, combined with other fields, valid DOCX)

### QID mapping:
| QID | Sub-Path | Field 2 Label |
|-----|----------|---------------|
| 80 | Speed-to-lead | First response time |
| 81 | Booking friction | Days to first appointment |
| 82 | Show rate | Show rate % |
| 83 | Quote follow-up / decision drop-off | Quote-to-close % |
| 84 | Channel concentration risk | % leads from top source |
| 85 | Lead capture friction | Calls answered live |
| 86 | Demand capture / local visibility | Inbound leads per month |
| 87 | Rebook/recall gap | Next step scheduled at job end |
| 88 | Referral ask gap | Referral intros per month |
| 89 | Post-service follow-up gap | % revenue from repeat |

---

## FILES MODIFIED IN PHASES 4 & 5

| File | Phase | Changes |
|---|---|---|
| `workers/mtg-scan-webhook/src/planGenerator.js` | 4, 5 | Opener wiring, phrasing bank tables, contradiction note, manual plan flag |
| `workers/mtg-scan-webhook/src/docxBuilder.js` | 4, 5 | Inline action format, data gap note, contradiction note rendering, manual plan flag rendering |
| `workers/mtg-scan-webhook/src/stopRules.js` | 5 | "Other (manual)" → degraded (not full stop) |
| `workers/mtg-scan-webhook/src/index.js` | 5 | Contradiction note field map, degraded handler path, HubSpot properties |
| `workers/mtg-scan-webhook/src/notifications.js` | 5 | Degraded plan notification function |
| `tests/stopRules.test.js` | 5 | +10 new tests (degraded behavior) |
| `tests/planGenerator.test.js` | 4, 5 | +12 new tests (opener, phrasing bank, contradiction note, manual flag) |
| `tests/docxBuilder.test.js` | 4, 5 | +12 new tests (inline actions, data gap note, contradiction note, manual flag) |
| `tests/scanWebhook.test.js` | 5 | +8 new tests (contradiction note extraction, degraded HubSpot, degraded handler) |
| `tests/scanTestCases.js` | review, 2.2 | Added oneLeverSentence + contradictionNote + field2Answer + field2Label defaults |
