# MindTheGaps MVP

Tyler and Jesse working for Marc on MindTheGaps, where we can house all the files and seamlessly work together!

---

## Build Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Setup + Schema | **Done** | Directory structure, shared constants |
| Phase 1: Quiz Build | **In Progress** | Scoring + Results done, 3 items remaining |
| Phase 2: Payment + Booking | Not started | Stripe, Calendly, prefill links |
| Phase 3: Scan Worksheet | Not started | JotForm worksheet + scan webhook |
| Phase 4: Plan Generation | Not started | Stop rules, confidence, Claude API, DOCX, R2, Resend |
| Phase 5: QA + Handoff | Not started | End-to-end testing, runbook, handoff to Marc |

---

## Phase 1 — Quiz Build (Current)

| # | Task | Status | File(s) | Tests |
|---|------|--------|---------|-------|
| 1 | Scoring engine | **Done** | `workers/mtg-quiz-webhook/src/scoring.js` | 51 tests passing |
| 2 | Results content generator | **Done** | `workers/mtg-quiz-webhook/src/results.js` | 25 tests passing |
| 3 | Eligibility check | To do | `workers/mtg-quiz-webhook/src/eligibility.js` | — |
| 4 | Webhook handler (index.js) | To do | `workers/mtg-quiz-webhook/src/index.js` | — |
| 5 | Results page (static HTML) | To do | `pages/results/` | — |

**Total tests: 76 passing (0 failing)**

---

## What's Been Built

### `workers/shared/constants.js`
Single source of truth for the entire project. Contains:
- Pillar enums (Acquisition, Conversion, Retention)
- All 13 scoring rules with point values and answer text
- C3 special routing table (MIXED question)
- Tie-break signal definitions and V1 answer mapping
- HubSpot field name prefixes

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

### `tests/testCases.js`
12 reusable fixtures with a `buildAnswers()` helper (sparse overrides on neutral defaults). Covers:
- Clear wins for each pillar
- All tie-break levels (Conv signal, Acq dual signal, Ret dual signal, V1, alphabetical)
- C3 routing variants (price objections, not right fit)
- Mixed realistic scenario
- Partial / missing answers

---

## What's Next

**Immediate (Phase 1 remaining):**
1. `eligibility.js` — Check if prospect qualifies for the paid scan ($295 CAD)
2. `index.js` — Webhook handler: receive JotForm POST → parse → score → generate results → write HubSpot → return results JSON
3. Results page — Static HTML/JS that reads results and displays gap + sub-diagnosis + cost-of-leak + next steps

**After Phase 1:**
- Phase 2: Stripe checkout + Calendly booking + prefill link generation
- Phase 3: Scan worksheet JotForm + scan webhook worker
- Phase 4: Stop rules → confidence → Claude API plan gen → DOCX → R2 → Resend notification

---

## Running Tests

```bash
npm test                    # Run all tests
npm run test:scoring        # Scoring engine only
npm run test:results        # Results generator only
```

Requires Node >= 18 (uses built-in `node:test` runner, zero external dependencies).

---

## Key Reference Files

- `CLAUDE.md` — Architecture, repo structure, build order, critical rules
- `PROJECT_CONTEXT.md` — Complete scoring matrix, HubSpot properties, sub-diagnosis mapping, cost-of-leak templates, scan worksheet field dictionary, stop rules, QA test cases
