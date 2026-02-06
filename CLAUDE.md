# MindtheGaps MVP — Claude Code Context

## What This Project Is

MindtheGaps (MTG) is a consulting automation system for a client named Marc. It helps small-to-medium local service businesses diagnose their primary "growth gap" (Acquire, Convert, or Retain customers) through a scored quiz, then delivers a personalized One-Page Plan after a paid 45-minute facilitator-led scan session.

## Architecture

```
Prospect takes Quiz (JotForm)
    → Cloudflare Worker scores quiz, writes HubSpot Contact
    → Results page shows gap + sub-diagnosis + cost-of-leak
    → If eligible: Stripe checkout ($295 CAD) → Calendly booking

Facilitator runs 45-min Scan (JotForm worksheet, prefilled from quiz)
    → Cloudflare Worker runs stop rules + confidence check
    → If OK: Claude API generates plan content → DOCX built → uploaded to R2
    → Marc notified via Resend email
    → Marc reviews, edits, sends plan within 24 hours
```

## Tech Stack

| Function | Tool | Notes |
|----------|------|-------|
| CRM | HubSpot (Contacts only) | All data on Contact records, dedupe by email, `mtg_` prefix properties |
| Forms | JotForm | Quiz + Scan Worksheet, webhooks to Workers |
| Automation/Logic | Cloudflare Workers | All scoring, stop rules, plan gen, webhook handling |
| AI | Claude API (via Workers) | Plan draft generation from scan data |
| Storage | Cloudflare R2 | DOCX plan drafts stored here |
| Payments | Stripe | $295 CAD one-time for scan |
| Booking | Calendly | 45-min scan session |
| Email | Resend | Notifications to Marc |

## Repo Structure

```
mindthegaps-mvp/
├── CLAUDE.md                   # THIS FILE — auto-read by Claude Code
├── PROJECT_CONTEXT.md          # Deep reference (scoring tables, field dictionary, rules)
├── workers/
│   ├── mtg-quiz-webhook/       # Receives JotForm quiz submission, scores, writes HubSpot
│   │   ├── src/
│   │   │   ├── index.js        # Worker entry point
│   │   │   ├── scoring.js      # Quiz scoring engine (pure functions)
│   │   │   ├── eligibility.js  # Scan eligibility check
│   │   │   └── results.js      # Results content generation (sub-diagnosis, signals, etc.)
│   │   ├── wrangler.toml
│   │   └── package.json
│   ├── mtg-stripe-webhook/     # Stripe payment confirmation → HubSpot update
│   ├── mtg-calendly-webhook/   # Calendly booking confirmation → HubSpot update
│   ├── mtg-scan-webhook/       # Scan worksheet → stop rules → plan gen → R2 → notify
│   │   ├── src/
│   │   │   ├── index.js        # Worker entry point
│   │   │   ├── stopRules.js    # Stop rule engine
│   │   │   ├── confidence.js   # Confidence calculator
│   │   │   ├── planGenerator.js # Claude API prompt builder + caller
│   │   │   ├── docxBuilder.js  # DOCX file generation
│   │   │   ├── storage.js      # R2 upload
│   │   │   └── notifications.js # Resend email sender
│   │   ├── wrangler.toml
│   │   └── package.json
│   └── shared/                 # Shared utilities imported by Workers
│       ├── hubspot.js          # HubSpot API client (upsert, get, update Contact)
│       ├── constants.js        # Enums, field names, option values
│       └── validation.js       # Email validation, field checks
├── pages/
│   └── results/                # Quiz results page (Cloudflare Pages, static HTML/JS)
├── tests/
│   ├── scoring.test.js         # Scoring engine unit tests (run with Node)
│   ├── stopRules.test.js       # Stop rules unit tests
│   ├── confidence.test.js      # Confidence calculator tests
│   ├── eligibility.test.js     # Eligibility logic tests
│   └── testCases.js            # Shared test data fixtures
└── docs/
    ├── runbook.md              # Ops runbook for Marc
    ├── field-mapping.md        # All HubSpot properties + sources
    └── architecture.md         # System diagram + decision log
```

## Build Order (What to Build When)

### Phase 0: Setup + Schema (now)
- Create HubSpot properties (see PROJECT_CONTEXT.md for full list)
- Deploy empty Worker shells with wrangler
- Create R2 bucket `mtg-plan-drafts`

### Phase 1: Quiz Build (first priority)
1. **scoring.js** — Pure function, zero dependencies. Build and test first.
2. **results.js** — Sub-diagnosis mapping, key signals, cost-of-leak text
3. **eligibility.js** — Scan eligibility check
4. **index.js** — Wire it together: receive JotForm webhook → score → write HubSpot → return results
5. **Results page** — Static HTML that displays results

### Phase 2: Payment + Booking
- Stripe checkout integration
- Calendly webhook handler
- Prefill link generator for scan worksheet

### Phase 3: Scan Worksheet
- JotForm worksheet build (7 sections, heavy conditionals)
- Scan webhook Worker

### Phase 4: Plan Generation
- Stop rules engine
- Confidence calculator
- Claude API plan generator
- DOCX builder
- R2 upload
- Resend notification

### Phase 5: QA + Handoff

## Critical Rules to Always Follow

### Naming Conventions
- HubSpot properties: `mtg_<short_name>` in lower_snake_case
- Workers: `mtg-<function-name>`
- JotForm forms: `mtg_quiz_v2_1e` and `mtg_scan_worksheet_v1`

### Data Rules
- **Contact-only** — no HubSpot Deals pipeline
- **Dedupe by email** — always upsert, never create duplicates
- **No sensitive data** — everything uses ranges/selects, no exact numbers
- **DOCX only** — no PDFs ever
- **Human-in-the-loop** — plans are NEVER auto-sent to clients

### Stop Rules (plan generation halted if ANY are true)
1. Sub-path = "not sure" or "Other (manual)"
2. Primary gap changed from quiz without explanation
3. Missing required fields (primary gap + sub-path + one lever + ≥5 baseline fields + all 6 actions + ≥2 metrics)
4. Fewer than 5 non-"Not sure" baseline field answers

### Confidence Calculation
- ≥4 "Not sure" answers → Low
- 2-3 "Not sure" answers → Med
- 0-1 "Not sure" answers → High

### Baseline Score Formula (locked by client)
```
baseline_score = ROUND(100 × (highest_gap_total / max_possible_for_that_gap), 0)
```

## Scoring Engine Quick Reference

See PROJECT_CONTEXT.md for the full scoring table. Summary:

- 14 questions, each adds 0-2 points to Acquisition, Conversion, or Retention
- V1 is non-scoring (tie-break only)
- C3 routes to different pillars based on the answer
- Primary Gap = pillar with highest total
- Tie-break order: Conversion signals → Acquisition signals → Retention signals → V1 answer

## Key Files to Reference

When building any component, check PROJECT_CONTEXT.md which contains:
- Complete scoring matrix (all 14 questions with point values)
- Full HubSpot property list
- Sub-diagnosis mapping rules
- Cost-of-leak templates
- Results page copy
- Scan worksheet field dictionary
- One Lever + Action Library content
- Traceability Map (plan field → worksheet source)
- Stop rules specification
- QA test cases
