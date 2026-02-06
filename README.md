# MindTheGaps MVP

Tyler and Jesse working for Marc on MindTheGaps, where we can house all the files and seamlessly work together!

---

## Build Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Setup + Schema | **Done** | Directory structure, shared constants |
| Phase 1: Quiz Build | **Done** | All 5 tasks complete, 107 tests passing |
| UX Polish | **Done** | One-question-per-page quiz, progress bar, spec-exact copy, results page updates |
| Phase 2: Payment + Booking | Not started | Stripe, Calendly, prefill links |
| Phase 3: Scan Worksheet | Not started | JotForm worksheet + scan webhook |
| Phase 4: Plan Generation | **In Progress** | Stop rules + confidence done (112 tests), Claude API/DOCX/R2/Resend remaining |
| Phase 5: QA + Handoff | Not started | End-to-end testing, runbook, handoff to Marc |

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

## What's Next

### Plug-and-play items (need credentials / config):
1. **HUBSPOT_API_KEY** — Set as Cloudflare Worker secret. HubSpot client is ready.
2. **JotForm field mapping** — Update `JOTFORM_FIELD_MAP` in index.js once the quiz form is built
3. **RESULTS_PAGE_URL** — Set as Worker env var once the results page is deployed
4. **Stripe checkout URL** — Update the CTA link in results page once Stripe is configured

### Phase 2: Payment + Booking
- Stripe checkout integration ($295 CAD)
- Calendly webhook handler (booking confirmation → HubSpot update)
- Prefill link generator for scan worksheet

### Phase 3: Scan Worksheet
- JotForm scan worksheet build (7 sections, heavy conditionals)
- Scan webhook Worker

### Phase 4: Plan Generation (remaining)
- ~~Stop rules engine~~ **Done** (76 tests)
- ~~Confidence calculator~~ **Done** (36 tests)
- Claude API plan generator
- DOCX builder
- R2 upload
- Resend notification

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
npm test                    # Run all tests (219)
npm run test:scoring        # Scoring engine only (51)
npm run test:results        # Results generator only (25)
npm run test:eligibility    # Eligibility check only (31)
npm run test:stoprules      # Stop rules engine only (76)
npm run test:confidence     # Confidence calculator only (36)
```

Requires Node >= 18 (uses built-in `node:test` runner, zero external dependencies).

---

## Key Reference Files

- `CLAUDE.md` — Architecture, repo structure, build order, critical rules
- `PROJECT_CONTEXT.md` — Complete scoring matrix, HubSpot properties, sub-diagnosis mapping, cost-of-leak templates, scan worksheet field dictionary, stop rules, QA test cases
