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
| 4 | **RESEND_API_KEY** | `re_KWb3PhrW_...` (test/burner key) | Production Resend API key (with verified domain) | Cloudflare Worker secret: `echo "re_live_xxx" \| npx wrangler secret put RESEND_API_KEY` in `workers/mtg-scan-webhook/` |
| 5 | **FROM_EMAIL** | `onboarding@resend.dev` (Resend test sender) | `notifications@mindthegaps.biz` (or similar, must be verified in Resend) | Cloudflare Worker secret: `echo "notifications@mindthegaps.biz" \| npx wrangler secret put FROM_EMAIL` in `workers/mtg-scan-webhook/` |
| 6 | **MARC_EMAIL** | `tyler@bryantworks.com` (Resend account owner — test keys can ONLY send to this address) | `marc@mindthegaps.biz` | Cloudflare Worker secret: `echo "marc@mindthegaps.biz" \| npx wrangler secret put MARC_EMAIL` in `workers/mtg-scan-webhook/` |
| 7 | **Custom Domain** (optional) | `mtg-pages-3yo.pages.dev` | Custom domain (e.g. `app.mindthegaps.biz`) | Cloudflare Dashboard → Pages → Custom Domains. Then update Stripe success URL and any hardcoded references. |

**How to change a Cloudflare Worker secret:**
```bash
cd workers/<worker-name>
echo "new-value" | npx wrangler secret put SECRET_NAME
```
No redeployment needed — secrets take effect immediately.

---

## Current Status (Feb 19, 2026)

| Component | Status | Details |
|-----------|--------|---------|
| Quiz + Scoring Engine | **Deployed** | 13-question quiz, scoring, results, eligibility |
| Results Page | **Deployed** | Gap diagnosis, score, CTA with Stripe link |
| Booking Page | **Deployed** | Calendly inline widget, shown after Stripe payment |
| Stripe Payment Webhook | **Deployed** | Receives checkout.session.completed, updates HubSpot |
| Calendly Booking Webhook | **Deployed** | Receives invitee.created, updates HubSpot |
| Scan Worksheet Processing | **Deployed** | Stop rules, confidence, plan generation, DOCX builder |
| HubSpot Integration | **Deployed** | 54 custom `mtg_` properties created and populated |
| R2 Storage | **Deployed** | `mtg-plan-drafts` bucket, DOCX download endpoint live |
| Email Notifications | **Deployed** | Resend configured (test mode), emails sent to Jesse for testing |

**390 tests passing, 0 failing**

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
# Run ALL 390 tests
npm test

# Or run tests for a specific module:
npm run test:scoring         # Quiz scoring engine (51 tests)
npm run test:results         # Results content generator (25 tests)
npm run test:eligibility     # Eligibility check (31 tests)
npm run test:stoprules       # Stop rules engine (76 tests)
npm run test:confidence      # Confidence calculator (36 tests)
npm run test:docxbuilder     # DOCX builder (51 tests)
npm run test:plangenerator   # Plan generator (44 tests)
npm run test:notifications   # Storage + notifications (15 tests)
npm run test:scanwebhook     # Scan webhook handler (23 tests)
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

### Secrets configured on workers (all set)

| Worker | Secrets Set |
|--------|------------|
| mtg-quiz-webhook | `HUBSPOT_API_KEY`, `RESULTS_PAGE_URL` |
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

All 54 custom properties use the `mtg_` prefix and live in the "mindthegaps" property group:
- Quiz fields: `mtg_quiz_v1`, `mtg_quiz_completed`, `mtg_primary_gap`, etc.
- Payment fields: `mtg_payment_status`, `mtg_stripe_payment_id`, `mtg_payment_date`
- Booking fields: `mtg_scan_booked`, `mtg_scan_scheduled_for`, `mtg_calendly_event_id`
- Scan fields: `mtg_scan_completed`, `mtg_scan_confidence`, `mtg_scan_primary_gap_confirmed`
- Plan fields: `mtg_plan_draft_link`, `mtg_plan_status`, `mtg_plan_review_status`

### Dual field name support

The quiz webhook accepts BOTH JotForm-prefixed field names (`q3_quiz_V1`, `q14_quiz_firstName`) and simple names (`V1`, `firstName`). This allows:
- The custom quiz page (`pages/quiz/`) to submit directly with simple names
- JotForm webhooks to work with prefixed names if JotForm is used later

### Non-blocking HubSpot writes

All webhook handlers use `ctx.waitUntil()` for HubSpot writes. The customer-facing response returns immediately; HubSpot updates happen in the background. If HubSpot fails, the customer experience is unaffected.

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
│   ├── landing/index.html       # Marketing landing page (from Figma)
│   └── scan/index.html          # Scan booking page (from Figma)
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
│   │   │   └── eligibility.js   # Scan eligibility check
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
│       │   ├── stopRules.js     # 3 stop conditions (sub-path, gap change, missing fields)
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
│   ├── results.test.js          # 25 tests
│   ├── eligibility.test.js      # 31 tests
│   ├── stopRules.test.js        # 76 tests
│   ├── confidence.test.js       # 36 tests
│   ├── docxBuilder.test.js      # 51 tests
│   ├── planGenerator.test.js    # 44 tests
│   ├── notifications.test.js    # 15 tests (storage + notifications)
│   ├── scanWebhook.test.js      # 23 tests
│   ├── stripeWebhook.test.js    # 16 tests
│   └── calendlyWebhook.test.js  # 19 tests
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
4. **Stop rules check**: Sub-path = "Not sure"/"Other"? Gap changed without reason? Missing required fields?
   - If stopped → writes stop reason to HubSpot, emails Marc "Manual plan required"
5. **Confidence calculation**: Counts "Not sure" baseline answers → High/Med/Low
6. **Plan generation** (deterministic): Lookup tables map sub-path → 30-day targets, compute personalization insights
7. **DOCX builder**: Generates One-Page Plan with 6 sections (What We Found, Baseline, One Lever, Action Plan, Scorecard, Risks)
8. **R2 upload**: Stores DOCX at `plans/{email}/{timestamp}.docx`
9. **HubSpot update**: Plan URL, confidence level, status, timestamps
10. **Email Marc**: "Plan draft ready for review" (via Resend — configured and live)

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
npm test                     # Run all 390 tests
npm run test:scoring         # Scoring engine (51)
npm run test:results         # Results generator (25)
npm run test:eligibility     # Eligibility check (31)
npm run test:stoprules       # Stop rules (76)
npm run test:confidence      # Confidence calculator (36)
npm run test:docxbuilder     # DOCX builder (51)
npm run test:plangenerator   # Plan generator (44)
npm run test:notifications   # Storage + notifications (15)
npm run test:scanwebhook     # Scan webhook handler (23)
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
1. **Switch Stripe to live mode** — Replace test payment link with production link, update `STRIPE_WEBHOOK_SECRET`
2. **Set Stripe success URL** — Redirect after payment to `https://mtg-pages-3yo.pages.dev/booking/` (in Stripe dashboard)
3. **Swap Resend to production** — New API key with verified domain, update `FROM_EMAIL` to `@mindthegaps.biz`
4. **Swap MARC_EMAIL** — Change from test email to `marc@mindthegaps.biz`
5. **End-to-end testing** — Test the full flow from quiz through plan delivery + email

### Nice-to-haves
- Tighten CORS from `*` to specific domains
- Add Calendly webhook signature verification (needs signing key from Calendly API)
- Marc's operational runbook (day-to-day procedures)
- Custom domain for Cloudflare Pages (instead of `mtg-pages-3yo.pages.dev`)

---

## Key Reference Files

- `CLAUDE.md` — Architecture, repo structure, build order, critical rules for AI assistants
- `PROJECT_CONTEXT.md` — Complete scoring matrix, HubSpot properties, sub-diagnosis mapping, cost-of-leak templates, scan field dictionary, stop rules, QA test cases
