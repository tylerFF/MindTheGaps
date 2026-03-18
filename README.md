# MindTheGaps MVP

Consulting automation system for Marc (marc@mindthegaps.biz). Automates the full pipeline from quiz intake through plan delivery.

**Customer flow:** Quiz → Results Page → Stripe Payment → Booking Page (Calendly) → Scan Worksheet → One-Page Plan (DOCX) → Email to Marc

---

## WHEN ABOUT TO GO LIVE, CHANGE THE FOLLOWING VALUES:

| # | What | Current (TEST) Value | Production Value | Where to Change |
|---|------|---------------------|-----------------|-----------------|
| 1 | **Stripe Payment Link** | `https://book.stripe.com/test_bJebJ28Jl30W3yL8Q81sQ01` (TEST mode) | Create a new **live** payment link in Stripe dashboard | `pages/results/index.html` — the `href` on the "Book the 45-Minute Growth Gap Scan" button |
| 2 | **Stripe Webhook Secret** | Test signing secret | New signing secret from live Stripe webhook endpoint | Cloudflare Worker secret: `echo "whsec_live_xxx" \| npx wrangler secret put STRIPE_WEBHOOK_SECRET` in `workers/mtg-stripe-webhook/` |
| 3 | **Stripe Success URL** | Currently redirects to Stripe default | Set to `https://mtg-pages-3yo.pages.dev/booking/` (or your custom domain) | Stripe Dashboard → Payment Links → Edit → After payment → Redirect URL |
| 4 | **RESEND_API_KEY** | Production key set (`re_5HDk...`) | Already configured | Cloudflare Worker secret on `mtg-scan-webhook` |
| 5 | **FROM_EMAIL** | `MindtheGaps <notifications@mindthegaps.biz>` | Already configured | Cloudflare Worker secret on `mtg-scan-webhook` |
| 6 | **MARC_EMAIL** | `marc@mindthegaps.biz` | Already configured | Cloudflare Worker secret on `mtg-scan-webhook` |
| 7 | **Custom Domain** (optional) | `mtg-pages-3yo.pages.dev` | Custom domain (e.g. `app.mindthegaps.biz`) | Cloudflare Dashboard → Pages → Custom Domains. Then update Stripe success URL and any hardcoded references. |

**How to change a Cloudflare Worker secret:**
```bash
cd workers/<worker-name>
echo "new-value" | npx wrangler secret put SECRET_NAME
```
No redeployment needed — secrets take effect immediately.

---

## Current Status (Mar 18, 2026)

### Core System — All Deployed, All Tested

| Component | Status | Details |
|-----------|--------|---------|
| Quiz + Scoring Engine | ✅ **Live** | 13-question quiz, scoring, results, eligibility |
| Results Page | ✅ **Live** | Gap diagnosis, score, product info + CTA with Stripe link |
| Booking Page | ✅ **Live** | Calendly inline widget, shown after Stripe payment |
| Stripe Payment Webhook | ✅ **Live** | Receives checkout.session.completed, updates HubSpot (TEST mode) |
| Calendly Booking Webhook | ✅ **Live** | Receives invitee.created, updates HubSpot |
| Scan Worksheet Processing | ✅ **Live** | Stop rules, confidence, plan generation, DOCX builder |
| HubSpot Integration | ✅ **Live** | 73 custom `mtg_` properties created and populated (54 base + 18 action + 1 prefill) |
| R2 Storage | ✅ **Live** | `mtg-plan-drafts` bucket, DOCX download endpoint live |
| Email Notifications | ✅ **Live** | Resend sends scan + quiz notifications to Marc (JotForm emails disabled) |
| Quiz → Scan Prefill | ✅ **Live** | Quiz submission generates prefilled scan worksheet URL, stored in HubSpot |

**575 tests passing, 0 failing**

### MVP Feedback Implementation — Complete

Tracked in: `docs/Marc MVP Feedback Docs/MindtheGaps_MVP_Feedback_Implementation_Checklist_FINAL_v5.md`

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 | Quiz UX (WS1: items 1.1–1.6) | ✅ Complete |
| Phase 2 | Scan Worksheet UX (WS2: items 2.1–2.2, 2.4–2.9) | ✅ Complete |
| Phase 3 | Contradiction Note Field (WS2: item 2.3) | ✅ Complete |
| Phase 4 | Plan Output — Safe Changes (WS3: items 3.1–3.3, 3.6) | ✅ Complete |
| Phase 5 | Plan Output — Behavioral Changes (WS3: items 3.4–3.5) | ✅ Complete |

### QA — Full E2E Tested (Mar 14-16)

Smoke tests run against live deployed system (v3 test scripts in `docs/`):

| Test | Sub-Path | Pillar Switch | Plan/Stop | Result |
|------|----------|---------------|-----------|--------|
| A1 | Channel concentration risk | Acquisition → Acquisition | ✅ DOCX generated | ✅ Pass |
| C1 | Speed-to-lead | Acquisition → Conversion | ✅ DOCX generated | ✅ Pass |
| R1 | Rebook/recall gap | Acquisition → Retention | ✅ DOCX generated | ✅ Pass |
| M1 | Other (manual):Acquisition | Acquisition → Acquisition | ✅ Stop rule fired | ✅ Pass |

All DOCX plans verified: correct business name, industry, gap, sub-path, lever, actions (text + owners + due dates), metrics, and confidence. Email notifications received for all tests.

---

### Next Steps

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | **Industry list review** — Marc to confirm whether to update the category list (see `docs/industry-refinement-notes.md`) | Marc | Waiting on Marc |
| 2 | ~~**Resend production setup**~~ | Tyler | ✅ Complete |
| 3 | **Stripe live mode** — Switch from test payment link to live, update `STRIPE_WEBHOOK_SECRET` (last thing before go-live) | Tyler + Marc | Not started |
| 4 | **Disable JotForm autoresponder** — Must be toggled manually in JotForm dashboard (API doesn't work) | Tyler | Pending |
| 5 | **Create `mtg_scan_prefill_url` in HubSpot** — Single-line text property in "mindthegaps" group (code writes it, but property may need to be created in dashboard) | Tyler | Pending |

### Previously Resolved

- **Item 2.2 — Field 2 Tie-Breaker Questions:** Complete. QIDs 80-89 with helper text. Backend extraction wired via `JOTFORM_SCAN_FIELD_MAP.field2BySubPath`.
- **Sub-Path Naming Mismatch:** Resolved. Backend phrasing bank keyed by actual JotForm dropdown values. No dropdown renaming needed.
- **Contradiction Note (Phase 5):** Implemented using **qid 79**. Fully wired: extraction → plan generation → DOCX rendering.
- **Conversion Field 2 Bug:** Fixed. 39 conditional fields set to `hidden: "Yes"` in JotForm. Verified working in live mode.
- **Predetermined Action Descriptions:** Fixed. `PREDETERMINED_ACTIONS` in `planGenerator.js` now matches `MTG_Action_Ladder_Reference_v2.xlsx` exactly (all 14 sub-paths × 6 actions).
- **JotForm Owner Field Defaults:** Fixed. 7 retention owner fields (R1-R4) had per-action values instead of reference line values. All 84 owner fields now verified against v2 reference.
- **Business Name / Industry Write-Back:** Fixed. Scan webhook now writes `mtg_business_name` and `mtg_industry` from scan form data to HubSpot.

---

## Quick Start: How to Test Everything

### Option 1: Local Test (no external services, fastest)

This runs the quiz + scoring + results locally on your machine. No HubSpot, no Stripe, no internet needed.

```bash
# 1. Open a terminal in the project folder
cd "C:\Users\vwill\Documents\Tyler Project\Project 1\MindTheGapsCodebase\MindTheGaps"

# 2. Start the dev server
npm run dev
```

Then open this in your browser: **http://localhost:3000**

Fill out the quiz, click "See My Results", and you'll see the results page. The terminal will log the scoring output. This does NOT write to HubSpot or charge anything.

### Option 2: Full Production Test (deployed workers, writes to HubSpot)

This tests the real deployed system. Your quiz answers hit the Cloudflare Worker, get scored, written to HubSpot, and you see the real results page.

**Step 1 — Take the quiz:** Open this link in your browser:

```
https://mtg-pages-3yo.pages.dev/quiz/
```

Fill it out with a test email you can look up in HubSpot later (e.g. `testuser@example.com`). Click "See My Results". You should be redirected to the results page with your diagnosis.

**Step 2 — Check HubSpot:** Log into HubSpot, search for the email you used. You should see all `mtg_` properties populated (quiz score, primary gap, eligibility, etc.).

**Step 3 — Test Stripe payment (optional):** On the results page, click the "Book the 45-Minute Growth Gap Scan" button. Use this test credit card:

```
Card number:  4242 4242 4242 4242
Expiry:       Any future date (e.g. 12/30)
CVC:          Any 3 digits (e.g. 123)
Name/address: Anything
```

After payment, check HubSpot again — `mtg_payment_status` should be "Paid".

**Step 4 — Test Calendly booking:** After Stripe payment, you should be redirected to the booking page at `https://mtg-pages-3yo.pages.dev/booking/`. Pick a time in the Calendly widget. After booking, check HubSpot — `mtg_scan_booked` should be "true".

> **Note:** For the redirect to work, the Stripe payment link's success URL must be set to `https://mtg-pages-3yo.pages.dev/booking/` in the Stripe dashboard.

**Step 5 — Test Scan Worksheet (triggers DOCX + email):** Open the JotForm scan worksheet:

```
https://form.jotform.com/260435948553162
```

Fill out all required fields (contact info, primary gap, sub-path, one lever, 6 actions, metrics). Submit the form. You should receive an email notification at the configured `MARC_EMAIL` address with a download link for the generated DOCX plan.

Check HubSpot: `mtg_plan_draft_link` should contain the download URL, `mtg_scan_confidence` should be set.

### Option 3: Run the Automated Tests

```bash
# Run ALL 575 tests
npm test

# Or run tests for a specific module:
npm run test:scoring         # Quiz scoring engine (51 tests)
npm run test:results         # Results content generator (29 tests)
npm run test:eligibility     # Eligibility check (31 tests)
npm run test:stoprules       # Stop rules engine (94 tests)
npm run test:confidence      # Confidence calculator (36 tests)
npm run test:docxbuilder     # DOCX builder (93 tests)
npm run test:plangenerator   # Plan generator (84 tests)
npm run test:notifications   # Storage + notifications (15 tests)
npm run test:scanwebhook     # Scan webhook handler (50 tests)
npm run test:stripewebhook   # Stripe webhook handler (16 tests)
npm run test:calendlywebhook # Calendly webhook handler (19 tests)
```

Requires Node 18+ (uses built-in `node:test` runner). Only external dependency: `docx`.

---

## Architecture

```
                    ┌──────────────────┐
                    │  Quiz Page       │  Cloudflare Pages
                    │  (pages/quiz/)   │  https://mtg-pages-3yo.pages.dev/quiz/
                    └────────┬─────────┘
                             │ POST (JSON)
                             ▼
                    ┌──────────────────┐
                    │  Quiz Webhook    │  Cloudflare Worker
                    │  Scores quiz,    │  https://mtg-quiz-webhook.mindthegaps-biz-account.workers.dev
                    │  writes HubSpot, │
                    │  returns results │
                    └────────┬─────────┘
                             │ Redirect (base64 in URL hash)
                             ▼
                    ┌──────────────────┐
                    │  Results Page    │  Cloudflare Pages
                    │  Shows diagnosis │  https://mtg-pages-3yo.pages.dev/results/
                    │  + Stripe CTA    │
                    └────────┬─────────┘
                             │ Customer clicks "Book Scan"
                             ▼
                    ┌──────────────────┐
                    │  Stripe Checkout │  Stripe (TEST mode)
                    │  $295 CAD        │  https://book.stripe.com/test_bJebJ28Jl30W3yL8Q81sQ01
                    └────────┬─────────┘
                             │ checkout.session.completed webhook + redirect
                             ▼
                    ┌──────────────────┐
                    │  Stripe Webhook  │  Cloudflare Worker
                    │  Updates HubSpot │  https://mtg-stripe-webhook.mindthegaps-biz-account.workers.dev
                    │  payment status  │
                    └──────────────────┘

                    ┌──────────────────┐
                    │  Booking Page    │  Cloudflare Pages
                    │  Calendly inline │  https://mtg-pages-3yo.pages.dev/booking/
                    │  widget embedded │  (Stripe redirects here after payment)
                    └────────┬─────────┘
                             │ Customer picks time → invitee.created webhook
                             ▼
                    ┌──────────────────┐
                    │  Calendly        │  Cloudflare Worker
                    │  Webhook         │  https://mtg-calendly-webhook.mindthegaps-biz-account.workers.dev
                    │  Updates HubSpot │
                    └────────┬─────────┘
                             │ Marc conducts scan, fills worksheet
                             ▼
                    ┌──────────────────┐
                    │  Scan Webhook    │  Cloudflare Worker
                    │  Stop rules →    │  https://mtg-scan-webhook.mindthegaps-biz-account.workers.dev
                    │  Plan gen →      │
                    │  DOCX → R2 →     │
                    │  HubSpot + Email │
                    └──────────────────┘
```

---

## Deployed Services

| Service | URL / ID |
|---------|----------|
| Quiz Page | `https://mtg-pages-3yo.pages.dev/quiz/` |
| Results Page | `https://mtg-pages-3yo.pages.dev/results/` |
| Booking Page | `https://mtg-pages-3yo.pages.dev/booking/` |
| Quiz Webhook | `https://mtg-quiz-webhook.mindthegaps-biz-account.workers.dev` |
| Stripe Webhook | `https://mtg-stripe-webhook.mindthegaps-biz-account.workers.dev` |
| Calendly Webhook | `https://mtg-calendly-webhook.mindthegaps-biz-account.workers.dev` |
| Scan Webhook | `https://mtg-scan-webhook.mindthegaps-biz-account.workers.dev` |
| DOCX Downloads | `https://mtg-scan-webhook.mindthegaps-biz-account.workers.dev/plans/{email}/{timestamp}.docx` |
| R2 Bucket | `mtg-plan-drafts` |
| Cloudflare Account | `29b45c8200ab5ef930e08946b9fad67a` |
| Stripe Checkout | `https://book.stripe.com/test_bJebJ28Jl30W3yL8Q81sQ01` (TEST mode) |
| Calendly Booking | `https://calendly.com/marc-tribeon/45-minute-growth-gap-scan` |

**Live customer flow:** Quiz (`/quiz/`) → Results (`/results/`) → Stripe → Booking (`/booking/`). The `/landing/` and `/scan/` pages are **not** part of the customer flow — they were early marketing page experiments and can be ignored.

### Secrets configured on workers (all set)

| Worker | Secrets Set |
|--------|------------|
| mtg-quiz-webhook | `HUBSPOT_API_KEY`, `RESULTS_PAGE_URL`, `FROM_EMAIL`, `RESEND_API_KEY`, `MARC_EMAIL`, `STRIPE_CHECKOUT_URL` |
| mtg-stripe-webhook | `HUBSPOT_API_KEY`, `STRIPE_WEBHOOK_SECRET` |
| mtg-calendly-webhook | `HUBSPOT_API_KEY` |
| mtg-scan-webhook | `HUBSPOT_API_KEY`, `RESEND_API_KEY`, `MARC_EMAIL`, `FROM_EMAIL` |

---

## Key Design Decisions

### Plan generation is DETERMINISTIC (no AI)

`planGenerator.js` uses **lookup tables and computed rules** — not Claude or any AI API. This was a deliberate decision (Feb 2026). The plan generator:
- Maps sub-paths to 30-day targets via lookup tables
- Computes personalization insights from scan data using rule-based logic
- Selects action plan templates based on primary gap + sub-path
- Produces structured JSON that the DOCX builder renders

### HubSpot property naming

All 73 custom properties use the `mtg_` prefix and live in the "mindthegaps" property group:
- Quiz fields: `mtg_quiz_v1`, `mtg_quiz_completed`, `mtg_primary_gap`, etc.
- Payment fields: `mtg_payment_status`, `mtg_stripe_payment_id`, `mtg_payment_date`
- Booking fields: `mtg_scan_booked`, `mtg_scan_scheduled_for`, `mtg_calendly_event_id`
- Scan fields: `mtg_scan_completed`, `mtg_scan_confidence`, `mtg_scan_primary_gap_confirmed`
- Plan fields: `mtg_plan_draft_link`, `mtg_plan_status`, `mtg_plan_review_status`
- Action fields: `mtg_scan_action1_desc` through `mtg_scan_action6_due` (18 properties — desc/owner/due for each of 6 actions)
- Prefill: `mtg_scan_prefill_url` (prefilled scan worksheet link, generated at quiz time)

### Dual field name support

The quiz webhook accepts BOTH JotForm-prefixed field names (`q3_quiz_V1`, `q14_quiz_firstName`) and simple names (`V1`, `firstName`). This allows:
- The custom quiz page (`pages/quiz/`) to submit directly with simple names
- JotForm webhooks to work with prefixed names if JotForm is used later

### Non-blocking HubSpot writes

All webhook handlers use `ctx.waitUntil()` for HubSpot writes. The customer-facing response returns immediately; HubSpot updates happen in the background. If HubSpot fails, the customer experience is unaffected.

---

## What Changed (Mar 18, 2026) — Results Page Product Info

### Results Page CTA — Product Info Block
- Added product summary block to the top of the results page CTA card (visible when eligible)
- Shows: product name ("MindtheGaps 45-Minute Growth Scan"), price (CA$295.00), and short description
- Matches the product listing shown on the Stripe checkout page for visual consistency
- Separated from the existing "Ready for Your Personalized Plan?" section by a divider

---

## What Changed (Mar 18, 2026) — Marc QA Feedback Round 1

Addressed 7 items from Marc's first facilitator-led QA run (A1 / Channel concentration risk scenario).

### 1. Scan Worksheet Prefill from Quiz
- Quiz webhook now generates a prefilled JotForm scan worksheet URL with contact info (name, email, business, industry) and primary gap pre-selected
- Prefill URL included in Marc's quiz notification email (blue box with clickable link)
- Prefill URL stored on HubSpot contact as `mtg_scan_prefill_url` for easy access
- Both `quizPrimaryGap` (q7) and `primaryGap` (q9) are prefilled so the facilitator doesn't need to re-select

### 2. Quiz Notification Email for Marc
- New styled HTML email sent to Marc on every quiz submission via Resend
- Includes: contact info, primary gap + score, sub-diagnosis, pillar totals, all quiz answers, and prefilled scan worksheet link
- Uses `ctx.waitUntil()` for non-blocking delivery
- `MARC_EMAIL` and `RESEND_API_KEY` secrets added to quiz webhook worker

### 3. Sub-Diagnosis-Specific Next Steps
- Results page now shows next steps tailored to the specific sub-diagnosis (e.g., "Channel concentration risk" vs "Demand shortfall") instead of generic pillar-level advice
- 11 sub-diagnosis entries added to `FASTEST_NEXT_STEPS` in `results.js`
- Pillar-level fallbacks preserved for edge cases with no sub-diagnosis match

### 4. JotForm Form Fixes (via API)
- q9 (Confirmed Primary Gap): Added helper text "Defaulted from quiz — change only if needed."
- q25 (Calls answered live): Added "Automated attendant / auto-answer" option
- q96 (A1 Action 2): Removed "secondary" from description text
- q27/q28 (Reviews/Referrals per month): Split "6+" into "6-10" and "11+" bands per Marc's request
- q43/q46/q49/q52/q55/q58: Updated due date labels to "Action N Due Date" format

### 5. Plan Generator Fix
- Updated A1 Action 2 description from "Choose ONE secondary warm channel to add." to "Choose ONE warm channel to add." (matches JotForm update)

### 6. JotForm Autoresponder
- API call to disable participant auto-email returns success but doesn't take effect — needs manual toggle in JotForm dashboard

### 7. Test Count: 575 passing (up from 571)
- Added sub-diagnosis next steps coverage tests
- Added fallback next steps tests

---

## What Changed (Mar 16, 2026 — Session 2)

### 1. Resend Email Notifications for Scan Webhook
- Configured production Resend API key, `FROM_EMAIL` (`notifications@mindthegaps.biz`), and `MARC_EMAIL` (`marc@mindthegaps.biz`) on the scan webhook
- Scan submissions now send styled HTML emails to Marc via Resend with: plan link, confidence, contact info, scan diagnosis, baseline answers, action plan table (6 actions with owners + due dates), metrics, and constraints
- Three email types: "Plan Draft Ready" (blue header), "Degraded Plan — Human Review Required" (amber header), "Scan Stopped — Manual Plan Required" (red header)

### 2. JotForm Emails Disabled
- Removed JotForm notification email (was showing `{}` for 80+ hidden predetermined fields and had broken "Form Title" header)
- Removed JotForm autoresponder (not needed per spec — plans are never auto-sent to clients)
- All scan notifications now handled exclusively by Resend via the Cloudflare Worker

### 3. HubSpot Action Properties (18 new)
- Created 18 new HubSpot properties: `mtg_scan_action1_desc` through `mtg_scan_action6_due` (description, owner, due date for each of 6 actions)
- Scan webhook now writes finalized action data (from plan generator lookup tables, with facilitator overrides) to HubSpot
- Total HubSpot properties: 72 (was 54)

### 4. Phone Number Fix
- JotForm sends phone as `{area:"555",phone:"1234567"}` object — was showing as `[object Object]` in emails and HubSpot
- Fixed `extractContactInfo()` to parse phone objects into readable format (`555-1234567`)

### 5. "Managed Services" Added to Quiz + Scan Worksheet
- Added "Managed Services" as a Business Type / Industry option to the quiz page (`pages/quiz/index.html`) and JotForm scan worksheet (Form ID: 260435948553162)

---

## What Changed (Mar 14-16, 2026)

QA testing session (Tyler + Claude) — full smoke test pass with live JotForm + deployed Workers.

### 1. Predetermined Action Descriptions Fixed
- `PREDETERMINED_ACTIONS` lookup table in `planGenerator.js` was missing or had incorrect action text for several sub-paths
- Rebuilt all 14 sub-paths × 6 actions to match `MTG_Action_Ladder_Reference_v2.xlsx` exactly
- Added comprehensive test coverage: 84 plan generator tests (up from 44), 93 DOCX builder tests (up from 51)

### 2. JotForm Owner Field Defaults Corrected
- 7 per-sub-path owner fields in Retention (R1-R4) had incorrect default values from source doc per-action text instead of reference line values
- All 84 owner fields (14 sub-paths × 6 actions) verified against v2 reference spreadsheet — all now correct

### 3. Business Name + Industry Write-Back
- Scan webhook now writes `mtg_business_name` and `mtg_industry` from scan form data to HubSpot
- Previously these fields were only set by the quiz webhook and never updated by the scan

### 4. JotForm Field 2 Conditional Logic
- Added conditional visibility for Field 2 follow-up questions on all sub-paths
- Fixed "What We Fix" (WWF) field ordering in predetermined field blocks

### 5. QA Test Scripts v3
- Created `docs/MindtheGaps_QA_Test_Scripts_Complete_v3.md` with 8 test scripts covering all pillars + manual stop rules
- Action text, owners, and due days validated against `MTG_Action_Ladder_Reference_v2.xlsx`

### 6. Test Count: 571 passing (up from 505)
- Stop rules: 94 tests (was 76)
- DOCX builder: 93 tests (was 51)
- Plan generator: 84 tests (was 44)
- Scan webhook: 50 tests (was 23)

---

## What Changed (Mar 6, 2026)

### 1. "Other (manual)" Changed from Degraded to Full Stop
- **stopRules.js**: "Other (manual)" sub-path and Field 2 "Not sure" now correctly produce `stopped=true` (full stop, no plan generated) instead of `degraded=true`
- Previously these cases still generated a plan draft with a "degraded" flag — now they halt plan generation entirely and route to Marc for manual plan creation
- Updated tests in `stopRules.test.js` and `scanWebhook.test.js` to match new behavior

### 2. JotForm "Other (manual)" Condition Fix
- When "Other (manual)" is selected as the sub-path, sections 3-6 (baselines, one lever, actions, metrics, constraints) are now hidden in the form
- Previously these sections remained visible even though the data would never be used
- Updated 3 JotForm conditions (one per pillar) to hide all section 3-6 fields
- Verified all 42 permutations of quiz gap x confirmed gap x sub-path via automated simulation — all pass

### 3. Documentation Updated
- CLAUDE.md: Fixed architecture description (deterministic plan gen, not Claude API), updated stop rules to include Field 2 "Not sure" as rule 1c
- README.md: Updated status date, stop rules count, scan flow description, added this changelog
- 571 tests passing, 0 failing

---



Full QA testing session (Tyler + Claude):

### 1. Scan Worksheet E2E Testing — All 3 Pillars Passed
- Submitted full test data for Acquisition, Conversion, and Retention paths
- Verified: JotForm submission → scan webhook → stop rules (none triggered) → plan generation → DOCX built → R2 upload → email notification
- All 3 plans generated with correct business name, gap, sub-path, lever, actions, and metrics
- Confidence = High on all 3 (zero "Not sure" answers in test data)
- Email notifications received for all 3 test submissions

### 2. Bug Fix: Conversion Field 2 Not Showing in Live Mode
- Conversion sub-path Field 2 dropdowns (QIDs 80-83) were visible in JotForm preview but not in live form
- Root cause: JotForm conditional fields default to `hidden: "No"` — preview mode ignores this, live mode respects it
- Fix: Set `hidden: "Yes"` on all 39 conditional Field 2 fields (QIDs 80-89) via JotForm API
- Verified: all Field 2 dropdowns now appear correctly in live mode when their sub-path is selected

### 3. Documentation Updated
- README updated with current status, QA results, and next steps
- Created `docs/industry-refinement-notes.md` — records Marc's decision to keep current industry list stable, plus proposed future refinements
- Test count confirmed: 571 passing, 0 failing

---

## What Changed (Feb 26, 2026)

MVP Feedback implementation session (Tyler + Claude):

### 1. Quiz UX — Phase 1 Complete (JotForm ID: 260466844433158)
- Added `control_text` helper elements ("Best estimate is fine...") above all 12 range questions (V2-V5, A1, C1-C4, R1-R3)
- Removed tooltip-style descriptions from radio buttons (replaced with visible text blocks)
- Added sublabels on Website and Phone fields with "(Optional)" helper text
- Shortened intro trust strip for mobile (dropped "no essays" line per spec fallback rule)
- Added mobile CSS: intro page padding, header padding, overflow constraints

### 2. Scan Worksheet UX — Phase 2 & 3 Partially Complete (JotForm ID: 260435948553162)
- Confirmed existing: Field 1 helper text, baseline reminders, owner quick-picks, action ladders (10), metric helpers, completion meter, copy/paste templates — all present from prior session
- Created contradiction note field: **qid 79** (`q79_contradictionNote`) — optional, max 120 chars, Section 2B
- Fixed description typos: `=200` → `≤200` (qid 10), `=160` → `≤160` (qid 39)
- Fixed metric description: `Lead-to-booked %` → `Lead to booked %` (qid 60, matches checkbox option)
- Verified ladder conditional visibility rules are correctly configured in JotForm conditions

### 3. Audit & Documentation
- Full audit of all 3 workstreams (findings documented in blockers section above)
- Identified Field 2 tie-breaker questions missing — emailed Marc for spec clarification
- Identified sub-path naming mismatch between dropdowns and spec — flagged, not changed
- Updated README with current implementation status, blockers, and action items

---

## What Changed (Feb 19, 2026)

These changes were made by Jesse (Williamsjesse22) working with Claude in the Feb 19 session:

### 1. Booking Page Created
Created `pages/booking/index.html` with an embedded Calendly inline widget. After Stripe payment, customers are redirected here to book their 45-Minute Growth Gap Scan. Uses Marc's Calendly URL: `https://calendly.com/marc-tribeon/45-minute-growth-gap-scan`.

### 2. DOCX Download Endpoint
Added a GET `/plans/*` route to the scan webhook worker so DOCX files stored in R2 are downloadable via a real URL (e.g. `https://mtg-scan-webhook.../plans/email@example.com/1234567890.docx`). Previously the plan URL was a broken relative path.

### 3. Email Notifications Configured
Set `RESEND_API_KEY`, `MARC_EMAIL`, and `FROM_EMAIL` secrets on the scan webhook worker. Marc (currently Jesse for testing) receives:
- **"Plan draft ready"** email when a DOCX is generated (includes download link + confidence level)
- **"Manual plan required"** email when stop rules fire (includes stop reasons)

### 4. JotForm Dropdown Fixes
- Removed "Please Select" placeholder from q7 (Primary Gap from Quiz) and q9 (Confirmed Primary Gap) on the scan worksheet
- Confirmed Retention option IS present in both dropdowns (just requires scrolling)

---

## What Changed (Feb 7 → Feb 18)

These changes were made by Jesse (Williamsjesse22) working with Claude in the Feb 18 session:

### 1. HubSpot Property Name Alignment
Fixed 9 property name mismatches between code and PROJECT_CONTEXT.md spec:
- **Scan webhook**: `mtg_primary_gap_confirmed` → `mtg_scan_primary_gap_confirmed`, `mtg_sub_path` → `mtg_scan_sub_path`, `mtg_one_lever` → `mtg_scan_one_lever`, `mtg_confidence_level` → `mtg_scan_confidence`, `mtg_plan_url` → `mtg_plan_draft_link`
- **Stripe webhook**: `mtg_payment_id` → `mtg_stripe_payment_id`, `mtg_payment_completed_at` → `mtg_payment_date`
- **Calendly webhook**: `mtg_scan_scheduled_time` → `mtg_scan_scheduled_for`, `mtg_calendly_event_uri` → `mtg_calendly_event_id`
- Added 4 new logging fields to scan webhook: `mtg_plan_drafted_at`, `mtg_plan_status`, `mtg_plan_generation_mode`, `mtg_scan_one_lever_sentence`

### 2. Plan Generator Rewrite (Deterministic)
Rewrote `planGenerator.js` to use lookup tables instead of Claude API. No AI dependency.

### 3. Setup Scripts Created
- `scripts/setup-hubspot-properties.js` — Creates all 54 `mtg_` HubSpot contact properties via API. Safe to re-run (skips existing).
- `scripts/setup-calendly-webhook.js` — Creates Calendly webhook subscription via API. Checks for existing subscriptions first.

### 4. Full Deployment
- Deployed all 4 Cloudflare Workers with secrets configured
- Created R2 bucket `mtg-plan-drafts` and bound to scan webhook
- Ran HubSpot setup script (54 properties created)
- Created Calendly webhook subscription (invitee.created)
- Added `nodejs_compat` compatibility flag to all workers (required for CJS imports)

### 5. Quiz Page Production Wiring
- Added `fetch()` submission to quiz page — auto-detects localhost vs production endpoint
- Added simple field name fallback to quiz webhook (accepts both JotForm and direct names)
- Updated dev server to return JSON (matches production worker response format)
- Deployed quiz + results pages to Cloudflare Pages (`mtg-pages-3yo.pages.dev`)
- Set `RESULTS_PAGE_URL` on quiz worker

### 6. Test Count Update
All tests updated to match new property names. **390 tests passing** (up from 387).

---

## Project Structure

```
MindTheGaps/
├── pages/
│   ├── quiz/index.html          # Multi-step quiz (15 steps, progress bar)
│   ├── results/index.html       # Results page (reads base64 from URL hash)
│   ├── booking/index.html       # Post-payment booking page (Calendly inline widget)
│   ├── landing/index.html       # Marketing landing page — OUT OF SCOPE, not in customer flow, can be ignored
│   └── scan/index.html          # Standalone scan landing page — OUT OF SCOPE, not in customer flow, can be ignored
│
├── workers/
│   ├── shared/
│   │   ├── constants.js         # All enums, scoring rules, thresholds
│   │   ├── hubspot.js           # HubSpot API client (upsert by email)
│   │   └── validation.js        # Email, string sanitization utilities
│   │
│   ├── mtg-quiz-webhook/
│   │   ├── src/
│   │   │   ├── worker.js        # ESM entry point (imports index.js)
│   │   │   ├── index.js         # Main handler — parse, score, results, HubSpot
│   │   │   ├── scoring.js       # Quiz scoring engine (pillar totals, tie-breaks)
│   │   │   ├── results.js       # Results content generator (diagnosis, cost of leak)
│   │   │   ├── eligibility.js   # Scan eligibility check
│   │   │   └── quizEmail.js     # Quiz results email, Marc notification, scan prefill URL
│   │   └── wrangler.toml
│   │
│   ├── mtg-stripe-webhook/
│   │   ├── src/
│   │   │   ├── worker.js        # ESM entry point
│   │   │   └── index.js         # Stripe signature verify → HubSpot update
│   │   └── wrangler.toml
│   │
│   ├── mtg-calendly-webhook/
│   │   ├── src/
│   │   │   ├── worker.js        # ESM entry point
│   │   │   └── index.js         # Calendly webhook → HubSpot update
│   │   └── wrangler.toml
│   │
│   └── mtg-scan-webhook/
│       ├── src/
│       │   ├── worker.js        # ESM entry point
│       │   ├── index.js         # Main orchestrator — parse → stop rules → plan → DOCX → R2
│       │   ├── stopRules.js     # 4 stop conditions (sub-path, field2, gap change, missing fields)
│       │   ├── confidence.js    # Not-sure count → High/Med/Low confidence
│       │   ├── planGenerator.js # DETERMINISTIC plan generation (lookup tables, no AI)
│       │   ├── docxBuilder.js   # One-Page Plan DOCX generator
│       │   ├── storage.js       # R2 upload wrapper
│       │   └── notifications.js # Resend email to Marc
│       └── wrangler.toml
│
├── scripts/
│   ├── setup-hubspot-properties.js  # Creates 54 mtg_ properties via HubSpot API
│   └── setup-calendly-webhook.js    # Creates Calendly webhook subscription
│
├── tests/
│   ├── testCases.js             # 12 quiz fixtures + buildAnswers() helper
│   ├── scanTestCases.js         # Scan worksheet fixtures + helpers
│   ├── scoring.test.js          # 51 tests
│   ├── results.test.js          # 29 tests
│   ├── eligibility.test.js      # 31 tests
│   ├── stopRules.test.js        # 94 tests
│   ├── confidence.test.js       # 36 tests
│   ├── docxBuilder.test.js      # 93 tests
│   ├── planGenerator.test.js    # 84 tests
│   ├── notifications.test.js    # 15 tests (storage + notifications)
│   ├── scanWebhook.test.js      # 50 tests
│   ├── stripeWebhook.test.js    # 16 tests
│   └── calendlyWebhook.test.js  # 19 tests
│
├── docs/
│   ├── MindtheGaps_QA_Test_Scripts_Complete_v3.md  # 8 QA test scripts (v3, validated against v2 reference)
│   ├── industry-refinement-notes.md  # Industry list decisions + future proposals
│   ├── Facilitator_Guide_vs_Worksheet_QA_Report.docx
│   └── Marc MVP Feedback Docs/      # Original MVP feedback tickets + checklist
│
├── dev-server.js                # Local dev server (http://localhost:3000)
├── package.json
├── CLAUDE.md                    # Architecture guide for AI assistants
├── PROJECT_CONTEXT.md           # Complete technical spec (scoring matrix, etc.)
└── README.md                    # This file
```

---

## How Each Component Works

### Quiz Page → Quiz Webhook → Results Page

1. Customer opens `https://mtg-pages-3yo.pages.dev/quiz/`
2. Fills out 13 questions + profile info (one question per page, progress bar)
3. Clicks "See My Results" → JavaScript sends `fetch()` POST to the quiz webhook worker
4. Worker runs: `parsePayload()` → `extractContactInfo()` → `extractQuizAnswers()` → `scoreQuiz()` → `generateResults()` → `checkEligibility()`
5. Worker writes all data to HubSpot (non-blocking via `ctx.waitUntil()`)
6. Worker returns JSON with `resultsUrl` (results data is base64-encoded in the URL hash)
7. Quiz page JavaScript redirects to the results URL
8. Results page decodes the hash, renders diagnosis with pillar-specific colors

### Stripe Payment → Booking Page

1. Customer clicks "Book the 45-Minute Growth Gap Scan — CAD $295" on results page
2. Stripe handles checkout, sends `checkout.session.completed` event to stripe webhook
3. Worker verifies HMAC-SHA256 signature, extracts payment data
4. Updates HubSpot: `mtg_payment_status=Paid`, amount, currency, payment ID, timestamp
5. Customer is redirected to `https://mtg-pages-3yo.pages.dev/booking/` (Stripe success URL)
6. Booking page shows embedded Calendly widget for Marc's 45-Minute Growth Gap Scan

### Calendly Booking Webhook

1. Customer picks a time on the booking page's Calendly widget
2. Calendly sends `invitee.created` event to calendly webhook
3. Worker extracts booking data (email, scheduled time, event URI)
4. Updates HubSpot: `mtg_scan_booked=true`, scheduled time, event ID

### Scan Worksheet → Plan Generation

1. Marc conducts the scan, fills out JotForm scan worksheet (Form ID: `260435948553162`)
2. JotForm sends webhook to scan webhook worker
3. Worker extracts scan data (baseline fields, actions, metrics, sub-path, one lever)
4. **Stop rules check**: Sub-path = "Not sure"/"Other"? Field 2 = "Not sure"? Gap changed without reason? Missing required fields?
   - If stopped → writes stop reason to HubSpot, emails Marc "Manual plan required"
5. **Confidence calculation**: Counts "Not sure" baseline answers → High/Med/Low
6. **Plan generation** (deterministic): Lookup tables map sub-path → 30-day targets, compute personalization insights
7. **DOCX builder**: Generates One-Page Plan with 6 sections (What We Found, Baseline, One Lever, Action Plan, Scorecard, Risks)
8. **R2 upload**: Stores DOCX at `plans/{email}/{timestamp}.docx`
9. **HubSpot update**: Plan URL, confidence level, status, timestamps
10. **Email Marc** via Resend (`notifications@mindthegaps.biz`): styled HTML with plan link, scan summary, action table, and confidence level

---

## Dev Server

```bash
npm run dev     # Start at http://localhost:3000
```

- **Quiz form:** http://localhost:3000/ — full quiz UI
- **Results page:** http://localhost:3000/results/ — renders after submit
- Runs the same scoring/results/eligibility pipeline as production
- Returns JSON response (same format as the production Cloudflare Worker)
- Logs quiz results to console on each submission
- Does NOT write to HubSpot (local only)

---

## Running Tests

```bash
npm test                     # Run all 575 tests
npm run test:scoring         # Scoring engine (51)
npm run test:results         # Results generator (25)
npm run test:eligibility     # Eligibility check (31)
npm run test:stoprules       # Stop rules (94)
npm run test:confidence      # Confidence calculator (36)
npm run test:docxbuilder     # DOCX builder (93)
npm run test:plangenerator   # Plan generator (84)
npm run test:notifications   # Storage + notifications (15)
npm run test:scanwebhook     # Scan webhook handler (50)
npm run test:stripewebhook   # Stripe webhook handler (16)
npm run test:calendlywebhook # Calendly webhook handler (19)
```

Requires Node >= 18 (uses built-in `node:test` runner). Only external dependency: `docx` (for DOCX generation).

---

## Deploying Changes

Each worker deploys independently via Wrangler:

```bash
cd workers/mtg-quiz-webhook && npx wrangler deploy
cd workers/mtg-stripe-webhook && npx wrangler deploy
cd workers/mtg-calendly-webhook && npx wrangler deploy
cd workers/mtg-scan-webhook && npx wrangler deploy
```

To redeploy the static pages:

```bash
npx wrangler pages deploy pages/ --project-name mtg-pages
```

To set secrets on a worker:

```bash
cd workers/mtg-quiz-webhook && echo "your-value" | npx wrangler secret put SECRET_NAME
```

---

## Setup Scripts

### HubSpot Properties

```bash
HUBSPOT_API_KEY=pat-xxx node scripts/setup-hubspot-properties.js
```

Creates all 54 `mtg_` contact properties in the "mindthegaps" group. Safe to re-run — skips properties that already exist.

### Calendly Webhook

```bash
CALENDLY_API_TOKEN=your-token WEBHOOK_URL=https://mtg-calendly-webhook.mindthegaps-biz-account.workers.dev node scripts/setup-calendly-webhook.js
```

Creates a webhook subscription for `invitee.created` events. Checks for existing subscriptions first.

---

## Remaining Work

### Before going live (see go-live checklist at top of this file)
1. ~~**Resend production setup**~~ — ✅ Done. Production API key set, `FROM_EMAIL` = `notifications@mindthegaps.biz`, `MARC_EMAIL` = `marc@mindthegaps.biz`
2. **Marc: Industry list decision** — Confirm current list is OK or approve changes (see `docs/industry-refinement-notes.md`)
3. **Switch Stripe to live mode** (last step) — Replace test payment link with production link, update `STRIPE_WEBHOOK_SECRET`, set success URL to `https://mtg-pages-3yo.pages.dev/booking/`
4. **Final E2E test on live Stripe** — One full pass with real payment to confirm everything works

### Nice-to-haves (post-launch)
- Tighten CORS from `*` to specific domains
- Add Calendly webhook signature verification (needs signing key from Calendly API)
- Marc's operational runbook (day-to-day procedures)
- Custom domain for Cloudflare Pages (instead of `mtg-pages-3yo.pages.dev`)
- Industry list refinement (documented in `docs/industry-refinement-notes.md`)

---

## Key Reference Files

- `CLAUDE.md` — Architecture, repo structure, build order, critical rules for AI assistants
- `PROJECT_CONTEXT.md` — Complete scoring matrix, HubSpot properties, sub-diagnosis mapping, cost-of-leak templates, scan field dictionary, stop rules, QA test cases
- `docs/industry-refinement-notes.md` — Industry list decisions, current list, proposed future changes (no action now)
