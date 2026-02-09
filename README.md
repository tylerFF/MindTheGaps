# MindTheGaps MVP

Tyler and Jesse working for Marc on MindTheGaps, where we can house all the files and seamlessly work together!

---

## Build Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Setup + Schema | **Done** | Directory structure, shared constants |
| Phase 1: Quiz Build | **Done** | All 5 tasks complete, 107 tests passing |
| UX Polish | **Done** | One-question-per-page quiz, progress bar, spec-exact copy, results page updates |
| Phase 2: Payment + Booking | **Done** | Stripe webhook (16 tests), Calendly webhook (19 tests) |
| Phase 3: Scan Worksheet | **Partial** | Backend complete (scan webhook + all processing), JotForm form needs Marc's account |
| Phase 4: Plan Generation | **Done** | Stop rules, confidence, plan generator, DOCX builder, storage, notifications (168 tests) |
| Phase 5: QA + Handoff | **Blocked** | Needs credentials for end-to-end testing |

**Total: 387 tests passing, 0 failing**

---

## Phase 1 — Quiz Build (Complete)

| # | Task | Status | File(s) | Tests |
|---|------|--------|---------|-------|
| 1 | Scoring engine | **Done** | `workers/mtg-quiz-webhook/src/scoring.js` | 51 tests |
| 2 | Results content generator | **Done** | `workers/mtg-quiz-webhook/src/results.js` | 25 tests |
| 3 | Eligibility check | **Done** | `workers/mtg-quiz-webhook/src/eligibility.js` | 31 tests |
| 4 | Webhook handler (index.js) | **Done** | `workers/mtg-quiz-webhook/src/index.js` | — |
| 5 | Results page (static HTML) | **Done** | `pages/results/index.html` | — |

**Phase 1 tests: 107 passing (0 failing)**

---

## Phase 4 — Plan Generation (Complete)

| # | Task | Status | File(s) | Tests |
|---|------|--------|---------|-------|
| 1 | Stop rules engine | **Done** | `workers/mtg-scan-webhook/src/stopRules.js` | 76 tests |
| 2 | Confidence calculator | **Done** | `workers/mtg-scan-webhook/src/confidence.js` | 36 tests |
| 3 | DOCX builder | **Done** | `workers/mtg-scan-webhook/src/docxBuilder.js` | 51 tests |
| 4 | Plan generator (Claude API prompt) | **Done** | `workers/mtg-scan-webhook/src/planGenerator.js` | 44 tests |
| 5 | R2 storage | **Done** | `workers/mtg-scan-webhook/src/storage.js` | 5 tests |
| 6 | Email notifications | **Done** | `workers/mtg-scan-webhook/src/notifications.js` | 10 tests |
| 7 | Scan webhook handler | **Done** | `workers/mtg-scan-webhook/src/index.js` | 23 tests |

**Phase 4 tests: 245 passing (0 failing)**

---

## Phase 2 — Payment + Booking (Complete)

| # | Task | Status | File(s) | Tests |
|---|------|--------|---------|-------|
| 1 | Stripe webhook handler | **Done** | `workers/mtg-stripe-webhook/src/index.js` | 16 tests |
| 2 | Calendly webhook handler | **Done** | `workers/mtg-calendly-webhook/src/index.js` | 19 tests |

**Phase 2 tests: 35 passing (0 failing)**

---

## What's Been Built

### `workers/shared/constants.js`
Single source of truth for the entire project. Contains:
- Pillar enums (Acquisition, Conversion, Retention)
- All 13 scoring rules with point values and answer text
- C3 special routing table (MIXED question)
- Tie-break signal definitions and V1 answer mapping
- HubSpot field name prefixes
- Scan worksheet Tier-1 baseline field keys per pillar (Conv=7, Acq=7, Ret=6)
- Sub-path options per pillar
- Scan thresholds (required actions=6, baseline answers=5, metrics=2)

### `workers/shared/validation.js`
Shared validation utilities used by webhook handlers:
- Email validation (format check) and normalization (trim + lowercase)
- Required field presence checks
- JotForm answer extraction with field mapping
- String sanitization (control chars, whitespace)

### `workers/shared/hubspot.js`
HubSpot Contacts v3 API client. Plug-and-play — pass `env.HUBSPOT_API_KEY` at runtime.
- `createHubSpotClient(apiKey)` factory returns `{ upsertContact, getContactByEmail, updateContact }`
- Deduplicates by email (search → create or update, never duplicate)
- Contact-only — no Deals pipeline (per spec)

### `workers/mtg-quiz-webhook/src/scoring.js`
Complete quiz scoring engine. Pure functions, zero side effects.
- `scoreQuiz(answers)` — takes `{ questionId: answerText }`, returns pillar totals, primary gap, baseline score (0-100), tie-break info, C3 route, max-possible per pillar
- Handles all C3 routing (5 answer variants route to different pillars)
- Implements full 4-level tie-break cascade: Conv signals → Acq signals (needs BOTH) → Ret signals (needs BOTH) → V1 answer → alphabetical fallback
- Baseline formula: `ROUND(100 * gap_total / max_possible, 0)`

### `workers/mtg-quiz-webhook/src/results.js`
Results content generator. Takes scoring output + raw answers, returns all display text.
- Sub-diagnosis selection (priority by highest contributing score, then definition order)
- Key signal picking (top 1-2 answers that scored +2)
- "Based on your answers: ..." line formatting
- Cost-of-leak text and advice per gap
- Fastest-next-step bullet templates per gap
- Primary gap statement templates

### `workers/mtg-quiz-webhook/src/eligibility.js`
Scan eligibility check. Pure function, determines if prospect qualifies for the $295 CAD paid scan.
- 3 automated checks from quiz data: basic numbers available, active demand/client base, offer clarity
- Returns `{ eligible, fixFirstReason, fixFirstAdvice, allReasons }`
- "Decision-maker will attend" assumed true for MVP (can't infer from quiz answers)
- Configurable thresholds (NOT_SURE_THRESHOLD = 5, CLARITY_NOT_SURE_THRESHOLD = 8)

### `workers/mtg-quiz-webhook/src/index.js`
Webhook handler — the main Cloudflare Worker entry point. Wires everything together:
1. Parses JotForm webhook payload (form-encoded or JSON, handles rawRequest)
2. Extracts contact info + quiz answers via configurable field map
3. Validates email
4. Runs scoring → results → eligibility pipeline
5. Builds HubSpot properties (all `mtg_*` fields) and upserts contact
6. Returns full results JSON + `resultsUrl` (base64-encoded data for results page)

### `pages/quiz/index.html`
Full quiz form with one-question-per-page UX (card layout). Spec-ready for Cloudflare Pages deployment.
- **15 steps:** intro screen, V1-V5, profile block (P1-P6), A1, C1-C4, R1-R3
- Radio buttons for all diagnostic questions (large tappable targets, all options visible)
- Progress bar at top fills as user advances
- Back/Next navigation with Next disabled until answer selected
- Profile block captures: name, email, business, industry, location, team size, website (optional), phone (optional)
- All question text and options are spec-exact (from Quiz Spec v2.1E)
- Mobile-responsive, Enter key advances to next question
- Traditional form POST on submit (feeds into the same scoring pipeline)

### `pages/results/index.html`
Static results page (Cloudflare Pages). Reads base64-encoded results from URL hash fragment.
- Displays: primary gap statement, score badge, sub-diagnosis, key signals, cost-of-leak, fastest next steps
- Eligible prospects see spec-exact CTA: "Book the 45-Minute Growth Gap Scan — CAD $295"
- Not-eligible prospects see fix-first reason + actionable advice + re-check eligibility link
- Mobile-responsive, no external dependencies, pillar-specific color themes

### `workers/mtg-scan-webhook/src/stopRules.js`
Stop rules engine. Pure function, checks scan worksheet data against 3 stop conditions.
- `checkStopRules(scanData)` — takes processed scan data, returns `{ stopped, reasons[], details[] }`
- Rule 1: Sub-path = "Not sure" or "Other (manual)" → halt
- Rule 2: Primary gap changed from quiz without explanation → halt
- Rule 3: Missing required fields (primary gap + sub-path + lever + ≥5 baseline + 6 actions + ≥2 metrics)
- Collects ALL stop reasons at once (doesn't short-circuit)

### `workers/mtg-scan-webhook/src/confidence.js`
Confidence calculator. Counts "Not sure"/missing Tier-1 baseline answers per pillar.
- `calculateConfidence(baselineFields, primaryGap)` → `{ level, notSureCount, totalFields, answeredCount, includeConstraints, includeDataGaps }`
- High (0-1 "Not sure"): constraints optional
- Med (2-3): must include ≥1 constraint row
- Low (≥4): must include constraints + "Data gaps to measure" box

### `workers/mtg-scan-webhook/src/docxBuilder.js`
One-Page Plan DOCX generator. Takes structured plan content from Claude API and produces a `.docx` file buffer.
- `buildDocx(planContent, scanData, contactInfo, confidenceResult)` → Buffer
- 6 section builders: What We Found, Baseline Metrics, One Lever, Action Plan (6 rows), Weekly Scorecard, Risks/Constraints
- Section F is conditional on confidence level (High=optional, Med=constraints required, Low=constraints + data gaps box)
- Professional styling: Calibri, 11pt body, 14pt headers, dark blue headings, gray table headers, 1" margins
- Exports `BASELINE_LABELS` (human-readable names for all 20 baseline field keys)

### `workers/mtg-scan-webhook/src/planGenerator.js`
Claude API prompt builder + response parser. Constructs the prompt from scan data, calls the API, parses JSON response.
- `generatePlan(scanData, contactInfo, confidenceResult, env)` → planContent JSON
- System prompt defines the exact JSON schema contract + content rules (plain language, no jargon, no upsell)
- User prompt includes: business profile, diagnosis, baseline metrics, actions, scorecard, confidence level
- `parseResponse()` handles raw JSON, markdown-fenced JSON, validates all 6 sections present
- `buildSectionBData()` filters baseline to exclude "Not sure" values (shared logic with docxBuilder)
- API call requires `CLAUDE_API_KEY` — throws without it

### `workers/mtg-scan-webhook/src/storage.js`
R2 upload wrapper. Uploads DOCX plan buffers to Cloudflare R2.
- `uploadPlan(env, email, buffer)` → object key string
- Key format: `plans/{sanitized-email}/{timestamp}.docx`
- Requires `R2_BUCKET` binding — throws without it

### `workers/mtg-scan-webhook/src/notifications.js`
Resend email notification sender. Notifies Marc when plans are ready or stopped.
- `notifyPlanReady(env, { email, businessName, planUrl, confidence })` — "Plan draft ready, review within 24h"
- `notifyStopRule(env, { email, businessName, stopReasons })` — "Manual plan required"
- Silently skips when `RESEND_API_KEY` is missing (same pattern as HubSpot)

### `workers/mtg-scan-webhook/src/index.js`
Scan webhook handler — the main orchestrator for the scan-to-plan pipeline:
1. Parses JotForm scan worksheet payload
2. Extracts contact info + scan data (baseline fields, actions, metrics) via configurable field map
3. Validates email
4. Runs stop rules — if stopped, writes reason to HubSpot + notifies Marc
5. Calculates confidence level
6. Generates plan via Claude API
7. Builds DOCX from plan content
8. Uploads DOCX to R2
9. Writes all results to HubSpot
10. Notifies Marc with plan link + confidence level
- All external calls gracefully skip when credentials are missing

### `workers/mtg-stripe-webhook/src/index.js`
Stripe webhook handler. Receives `checkout.session.completed` events from Stripe.
- Verifies webhook signature (HMAC-SHA256 via Web Crypto)
- Extracts: email, amount, currency, payment intent ID
- Updates HubSpot: `mtg_payment_status=Paid`, amount, currency, payment ID, timestamp
- Skips signature verification in dev mode (no secret)

### `workers/mtg-calendly-webhook/src/index.js`
Calendly webhook handler. Receives `invitee.created` events from Calendly.
- Verifies webhook signature (HMAC-SHA256 via Web Crypto)
- Extracts: email, name, event URI, scheduled time, cancel/reschedule URLs
- Updates HubSpot: `mtg_scan_booked=true`, scheduled time, event URI
- Skips signature verification in dev mode (no secret)

### `tests/testCases.js`
12 reusable quiz fixtures with a `buildAnswers()` helper (sparse overrides on neutral defaults). Covers:
- Clear wins for each pillar
- All tie-break levels (Conv signal, Acq dual signal, Ret dual signal, V1, alphabetical)
- C3 routing variants (price objections, not right fit)
- Mixed realistic scenario
- Partial / missing answers

### `tests/scanTestCases.js`
Scan worksheet test fixtures with `buildScanData()` and `buildBaselineWithNotSure()` helpers.
- Default baseline field sets for all 3 pillars (Conv=7, Acq=7, Ret=6)
- Default actions (6 filled), metrics (3 filled)
- Sparse override pattern (uses `in` operator to properly handle empty-string overrides)

---

## What's Left — Credential-Dependent Work Only

All pure-logic code is complete. The remaining work requires Marc's accounts/credentials:

### Plug-and-play credential swaps (minutes each):
| Service | What to do | Time estimate |
|---------|-----------|---------------|
| HubSpot | Set `HUBSPOT_API_KEY` env var + create ~20 `mtg_*` properties in UI | ~15 min |
| JotForm | Update `JOTFORM_FIELD_MAP` / `JOTFORM_SCAN_FIELD_MAP` with real field names | ~30 min |
| Stripe | Set `STRIPE_WEBHOOK_SECRET` env var | ~2 min |
| Calendly | Set `CALENDLY_WEBHOOK_SECRET` env var | ~2 min |
| Claude API | Set `CLAUDE_API_KEY` env var | ~2 min |
| Resend | Set `RESEND_API_KEY` + `MARC_EMAIL` env vars | ~2 min |
| R2 | Create `mtg-plan-drafts` bucket + bind in wrangler.toml | ~5 min |
| Cloudflare | Deploy workers via `wrangler publish` (needs account access) | ~15 min |

### Still needs building (requires Marc's accounts):
1. **JotForm Quiz form** — Build in Marc's JotForm account, get field names for `JOTFORM_FIELD_MAP`
2. **JotForm Scan Worksheet form** — Build 7-section form in Marc's account, get field names for `JOTFORM_SCAN_FIELD_MAP`
3. **HubSpot custom properties** — Create ~20 `mtg_*` contact properties in Marc's HubSpot
4. **End-to-end integration testing** — Test the full flow with real services connected
5. **Marc's runbook** — Ops documentation for day-to-day use

---

## Dev Server

```bash
npm run dev     # Start at http://localhost:3000
```

- **Quiz form:** http://localhost:3000/ — full one-question-per-page quiz with progress bar
- **Results page:** http://localhost:3000/results/ — displays after quiz submit
- Runs the production scoring pipeline locally (scoring → results → eligibility)
- Profile fields + scoring output logged to console on each submission

---

## Running Tests

```bash
npm test                    # Run all tests (387)
npm run test:scoring        # Scoring engine only (51)
npm run test:results        # Results generator only (25)
npm run test:eligibility    # Eligibility check only (31)
npm run test:stoprules      # Stop rules engine only (76)
npm run test:confidence     # Confidence calculator only (36)
npm run test:docxbuilder    # DOCX builder only (51)
npm run test:plangenerator  # Plan generator only (44)
npm run test:notifications  # Storage + notifications (15)
npm run test:scanwebhook    # Scan webhook handler (23)
npm run test:stripewebhook  # Stripe webhook handler (16)
npm run test:calendlywebhook # Calendly webhook handler (19)
```

Requires Node >= 18 (uses built-in `node:test` runner, zero external dependencies except `docx`).

---

## Key Reference Files

- `CLAUDE.md` — Architecture, repo structure, build order, critical rules
- `PROJECT_CONTEXT.md` — Complete scoring matrix, HubSpot properties, sub-diagnosis mapping, cost-of-leak templates, scan worksheet field dictionary, stop rules, QA test cases
