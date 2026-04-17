# MindtheGaps — Codebase Overview

A single GitHub repo containing everything: 4 Cloudflare Workers, static web pages, tests, and documentation.

---

## Root-Level Files

| File | Description |
|------|-------------|
| **`README.md`** | Project status, go-live checklist, changelog of recent updates |
| **`PROJECT_CONTEXT.md`** | Deep technical spec: scoring tables, HubSpot property list, sub-diagnosis rules. The detailed reference. |
| **`.gitignore`** | Lists files/folders that git should ignore (e.g. `node_modules/`, local-only files) |
| **`package.json`** | Node.js project manifest. Lists dependencies and test commands. Don't edit by hand. |
| **`package-lock.json`** | Auto-generated file locking exact dependency versions. Never edit by hand. |

---

## `workers/` — The 4 Cloudflare Workers

Small JavaScript programs that run on Cloudflare's servers. They receive webhooks from JotForm, Stripe, and Calendly, then do the logic and update HubSpot. **This is where the "brain" of the system lives.**

### `workers/mtg-quiz-webhook/`
Processes quiz submissions. When someone fills out the JotForm quiz, JotForm sends answers here.

| File | Purpose |
|------|---------|
| **`src/index.js`** | Main handler; maps JotForm fields to internal names |
| **`src/scoring.js`** | Scoring engine (pure math: takes answers → returns primary growth gap + score) |
| **`src/results.js`** | Sub-diagnosis text, cost-of-leak copy, fastest-next-steps shown on results page |
| **`src/eligibility.js`** | Decides who qualifies for the $295 scan |
| **`src/quizEmail.js`** | Results email + Marc's notification + builds the scan prefill URL |
| **`wrangler.toml`** | Cloudflare deployment config (KV cache, etc.) |

### `workers/mtg-scan-webhook/`
Processes scan worksheet submissions. When Marc finishes the 45-min facilitator session in JotForm, this worker generates the plan.

| File | Purpose |
|------|---------|
| **`src/index.js`** | Main handler; maps all scan form fields |
| **`src/planGenerator.js`** | Fallback lookup tables for action text and one-liners (JotForm is source of truth; this is the safety net) |
| **`src/stopRules.js`** | The 4 stop rules that halt plan generation if data is incomplete |
| **`src/confidence.js`** | Calculates Low / Med / High confidence based on "Not sure" count |
| **`src/docxBuilder.js`** | Builds the actual Word document (One-Page Plan) |
| **`src/storage.js`** | Uploads the DOCX to Cloudflare R2 (file storage) |
| **`src/notifications.js`** | Sends Marc the "draft ready" email with download link |
| **`wrangler.toml`** | Cloudflare config (R2 bucket binding, etc.) |

### `workers/mtg-stripe-webhook/`
Listens for Stripe payment confirmations. Updates HubSpot when someone pays $295.

- **`src/index.js`** — Parses Stripe webhook, updates HubSpot contact with payment status

### `workers/mtg-calendly-webhook/`
Listens for Calendly bookings. Updates HubSpot when someone books the scan session.

- **`src/index.js`** — Parses Calendly webhook, updates HubSpot contact with booking time

### `workers/shared/`
Code used by multiple workers.

| File | Purpose |
|------|---------|
| **`constants.js`** | **The scoring matrix.** All 14 quiz questions, exact answer text, point values, tie-break rules, HubSpot property name prefixes. *This is where to edit if you want to change how scoring works.* |
| **`hubspot.js`** | HubSpot API client (upserts contacts by email) |
| **`validation.js`** | Email validation and string cleanup helpers |

---

## `pages/` — Static Website (Cloudflare Pages)

Plain HTML pages. Hosted on Cloudflare Pages at `mtg-pages-3yo.pages.dev`.

| Page | Purpose |
|------|---------|
| **`pages/quiz/index.html`** | Redirect stub that forwards `/quiz/` to the JotForm quiz (preserves old bookmarks) |
| **`pages/loading/index.html`** | Spinner page shown after quiz submission. Polls the worker for results, then redirects to results page. |
| **`pages/results/index.html`** | Shows the prospect their growth gap, score, sub-diagnosis, cost-of-leak, and the $295 scan booking CTA (if eligible) |
| **`pages/booking/index.html`** | Calendly booking widget. Shown after Stripe payment. |
| **`pages/landing/index.html`** | Marketing landing page |
| **`pages/scan/index.html`** | Scan info page (not the actual JotForm) |
| **`pages/assets/`** | Images, logos, shared CSS |

---

## `tests/` — Automated Tests

578 tests that verify every part of the system works correctly. Run `npm test` to execute all of them. **Always run tests before deploying code changes** — if a test fails, don't deploy.

| Test File | Tests |
|-----------|-------|
| `scoring.test.js` | Quiz scoring engine |
| `results.test.js` | Results content generation |
| `eligibility.test.js` | Scan eligibility logic |
| `stopRules.test.js` | Plan generation stop rules |
| `confidence.test.js` | Confidence calculator |
| `docxBuilder.test.js` | DOCX file builder |
| `planGenerator.test.js` | Plan content generator |
| `predetermined.test.js` | Predetermined action lookups |
| `notifications.test.js` | R2 storage + email notifications |
| `quizEmail.test.js` | Quiz results email rendering |
| `scanWebhook.test.js` | Scan webhook handler |
| `stripeWebhook.test.js` | Stripe webhook handler |
| `calendlyWebhook.test.js` | Calendly webhook handler |
| `scanTestCases.js` / `testCases.js` | Shared test data fixtures (not executable tests) |

---

## `scripts/` — One-Time Setup Scripts

Utility scripts for initial system setup. Not day-to-day operation — but critical for disaster recovery (rebuilding from scratch).

| Script | Purpose |
|--------|---------|
| **`setup-hubspot-properties.js`** | Creates all `mtg_` custom contact properties in HubSpot. Safe to re-run (skips existing). |
| **`setup-calendly-webhook.js`** | Creates the Calendly webhook subscription via API. |
| **`jotform-scan-setup.js`** | Builds the scan worksheet's predetermined action fields in JotForm. |

---

## `scratchpad/` — Disaster Recovery Script

- **`restore_all_conditions.js`** — Authoritative 40-condition JotForm conditional logic set for the scan worksheet. If conditions ever get broken, run this to restore them. Referenced by REBUILD_GUIDE.

---

## `docs/` — Documentation

| Document | Purpose |
|----------|---------|
| **`REBUILD_GUIDE.md`** | **Start here.** Full technical reference. Everything needed to rebuild or understand the system. |
| **`CODEBASE_OVERVIEW.md`** | This document. Folder-by-folder description of what's where. |
| **`quiz-migration-plan.md`** | Historical doc: the plan for migrating the quiz from custom HTML to JotForm (completed April 2026) |
| **`MindtheGaps_QA_Test_Scripts_Complete_v3.md` / `.docx`** | Manual QA test scenarios for end-to-end testing |
| **`MTG_Action_Ladder_Reference_v2.xlsx`** | Master spreadsheet of all action text for every sub-path |
| **`MTG_JotForm_Conditions_Cheatsheet.xlsx`** | Visual reference for all 40 JotForm conditional logic rules (which condition controls which sub-path) |
| **`industry-refinement-notes.md`** | Notes on the industry dropdown options |
| **`marc-reply-draft`** | Draft communication with Marc |
| **`Marc MVP Feedback Docs/`** | Historical feedback tracking from MVP phase |
| **`figma/`** | Design mockups (landing page, scan page) |

---

## How Everything Connects

```
User fills JotForm quiz
  → JotForm webhook → mtg-quiz-webhook (Worker)
  → Worker scores, writes HubSpot, stores results in KV cache
  → JotForm redirects user to /loading/?sid={id}
  → Loading page polls worker, redirects to /results/#data
  → Results page shows gap + Stripe "Book Scan" CTA

User clicks "Book Scan" → Stripe checkout
  → Stripe webhook → mtg-stripe-webhook (Worker)
  → Worker marks HubSpot contact as paid
  → User redirected to /booking/ (Calendly)

User books Calendly time
  → Calendly webhook → mtg-calendly-webhook (Worker)
  → Worker saves booking time to HubSpot

Marc runs 45-min scan session, submits JotForm scan worksheet
  → JotForm webhook → mtg-scan-webhook (Worker)
  → Worker runs stop rules, generates plan, builds DOCX
  → DOCX uploaded to R2 storage
  → Email sent to Marc with download link
```

---

## Deploying Code Changes

```bash
# Deploy a worker (run from that worker's folder)
cd workers/mtg-quiz-webhook && npx wrangler deploy

# Deploy static pages
npx wrangler pages deploy pages/ --project-name mtg-pages --branch main

# Update a secret (API key)
echo "new-value" | npx wrangler secret put SECRET_NAME
```

All secrets (API keys) are stored in Cloudflare, never in the code. They take effect immediately without redeployment.

---

## Where to Make Changes

| Want to change... | Where |
|-------------------|-------|
| Quiz question wording or answer text | JotForm form 260466844433158 (UI only) |
| Scan worksheet action text | JotForm form 260435948553162 (UI only) |
| Scoring point values | `workers/shared/constants.js` (code + deploy) |
| Eligibility thresholds | `workers/mtg-quiz-webhook/src/eligibility.js` |
| Sub-diagnosis / cost-of-leak text | `workers/mtg-quiz-webhook/src/results.js` |
| Results page layout | `pages/results/index.html` |
| Email wording | `workers/mtg-quiz-webhook/src/quizEmail.js` or `workers/mtg-scan-webhook/src/notifications.js` |
| Plan DOCX template | `workers/mtg-scan-webhook/src/docxBuilder.js` |
