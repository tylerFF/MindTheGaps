# MindtheGaps MVP — Complete Rebuild Guide

**Last updated:** April 16, 2026

This document contains everything needed to rebuild the MindtheGaps system from scratch. It covers every service, every field, every business rule, every integration, and every configuration detail. Hand this to any developer and they can reconstruct the entire system.

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [End-to-End Flow](#2-end-to-end-flow)
3. [Tech Stack](#3-tech-stack)
4. [Accounts & Credentials](#4-accounts--credentials)
5. [Quiz — Scoring Engine](#5-quiz--scoring-engine)
6. [Quiz — Results & Sub-Diagnosis](#6-quiz--results--sub-diagnosis)
7. [Quiz — Eligibility Check](#7-quiz--eligibility-check)
8. [Quiz — JotForm & Webhook](#8-quiz--jotform--webhook)
9. [Results Page](#9-results-page)
10. [Payment — Stripe](#10-payment--stripe)
11. [Booking — Calendly](#11-booking--calendly)
12. [Scan Worksheet — JotForm Setup](#12-scan-worksheet--jotform-setup)
13. [Scan Webhook — Processing Pipeline](#13-scan-webhook--processing-pipeline)
14. [Stop Rules Engine](#14-stop-rules-engine)
15. [Confidence Calculator](#15-confidence-calculator)
16. [Plan Generator — Lookup Tables](#16-plan-generator--lookup-tables)
17. [DOCX Builder — One-Page Plan](#17-docx-builder--one-page-plan)
18. [Email Notifications — Resend](#18-email-notifications--resend)
19. [HubSpot — All 80 Properties](#19-hubspot--all-79-properties)
20. [R2 Storage — Plan Drafts](#20-r2-storage--plan-drafts)
21. [Cloudflare Workers — Deployment](#21-cloudflare-workers--deployment)
22. [JotForm Conditional Logic (42 Rules)](#22-jotform-conditional-logic-42-rules)
23. [JotForm API Gotchas](#23-jotform-api-gotchas)
24. [Testing](#24-testing)
25. [Critical Business Rules](#25-critical-business-rules)

---

## 1. What This System Does

MindtheGaps (MTG) is a consulting automation system for a consultant named Marc. It helps small-to-medium local service businesses diagnose their primary "growth gap" — Acquire, Convert, or Retain customers — through a scored quiz, then delivers a personalized One-Page Plan after a paid 45-minute facilitator-led scan session.

**The three pillars:**
- **Acquisition** — Getting enough qualified leads
- **Conversion** — Turning leads into booked work
- **Retention** — Repeats, reviews, referrals, and expansion

---

## 2. End-to-End Flow

```
1. Prospect takes 13-question Quiz (JotForm)
   → Cloudflare Worker scores quiz, writes HubSpot Contact
   → Results page shows gap + sub-diagnosis + cost-of-leak

2. If eligible: Stripe checkout ($295 CAD)
   → Stripe webhook updates HubSpot payment status
   → Customer redirected to Calendly booking page

3. Customer books 45-min scan session via Calendly
   → Calendly webhook updates HubSpot booking status

4. Marc runs scan session, fills JotForm scan worksheet
   → Cloudflare Worker receives webhook
   → Runs stop rules (5 checks)
   → If stopped: notifies Marc, writes HubSpot → DONE
   → If OK: calculates confidence (High/Med/Low)
   → Generates plan deterministically (lookup tables, NO AI)
   → Builds DOCX file
   → Uploads DOCX to Cloudflare R2
   → Writes all data to HubSpot (72 properties)
   → Emails Marc via Resend with plan link + full scan summary

5. Marc reviews, edits, sends plan to client within 24 hours
   (Plans are NEVER auto-sent to clients)
```

---

## 3. Tech Stack

| Function | Service | Details |
|----------|---------|---------|
| CRM | HubSpot | Contacts only, no Deals. 73 custom `mtg_` properties. Dedupe by email. |
| Quiz Form | JotForm (Form ID: 260466844433158) | Public URL: `form.jotform.com/260466844433158`. `pages/quiz/index.html` is a small redirect stub forwarding `/quiz/` to JotForm (preserves old bookmarks). |
| Scan Worksheet | JotForm | Form ID: `260435948553162`. EU endpoint (`eu-api.jotform.com`). |
| Automation | Cloudflare Workers | 4 workers handle all webhooks + logic |
| Plan Generation | Deterministic | Lookup tables in `planGenerator.js` — zero AI |
| Plan Files | DOCX (never PDF) | Built with `docx` npm package |
| File Storage | Cloudflare R2 | Bucket: `mtg-plan-drafts` |
| Payments | Stripe | $295 CAD one-time. LIVE mode. Payment link: `plink_1T6fMPJuBZDzKCsm6D9fPp0h` |
| Booking | Calendly | Marc's calendar: `calendly.com/marc-tribeon/45-minute-growth-gap-scan` |
| Email | Resend | From: `notifications@mindthegaps.biz`. Domain verified. |
| Hosting | Cloudflare Pages | Project: `mtg-pages`. Static HTML/JS/CSS. |
| Tests | Node.js built-in | `node:test` runner. 578 tests. Only dependency: `docx`. |

---

## 4. Accounts & Credentials

| Service | Account | Notes |
|---------|---------|-------|
| Cloudflare | `marc@mindthegaps.biz` | Account ID: `29b45c8200ab5ef930e08946b9fad67a` |
| HubSpot | Marc's account | Private app token stored as Worker secret |
| JotForm | EU endpoint | API key provided per session, never hardcoded |
| Stripe | Marc's account | LIVE mode. Payment link redirects to Calendly booking page after checkout. |
| Calendly | `marc-tribeon` | Webhook subscription for `invitee.created` |
| Resend | `mindthegaps` | Domain `mindthegaps.biz` verified. API key: `re_5HDk...` |
| GitHub | `tylerFF/MindTheGaps` | Main branch: `main` |

### Worker Secrets (set via `wrangler secret put`)

| Worker | Secrets |
|--------|---------|
| mtg-quiz-webhook | `HUBSPOT_API_KEY`, `RESULTS_PAGE_URL`, `FROM_EMAIL`, `RESEND_API_KEY`, `MARC_EMAIL`, `STRIPE_CHECKOUT_URL` |
| mtg-stripe-webhook | `HUBSPOT_API_KEY`, `STRIPE_WEBHOOK_SECRET` |
| mtg-calendly-webhook | `HUBSPOT_API_KEY` |
| mtg-scan-webhook | `HUBSPOT_API_KEY`, `RESEND_API_KEY`, `MARC_EMAIL`, `FROM_EMAIL` |

---

## 5. Quiz — Scoring Engine

**File:** `workers/mtg-quiz-webhook/src/scoring.js`

### 13 Questions — Complete Scoring Matrix

| Q# | ID | Text | Pillar | +2 Answer | +1 Answer | 0 (all others) |
|----|----|------|--------|-----------|-----------|-----------------|
| 1 | V1 | "What feels like your biggest challenge?" | Non-scoring (tie-break only) | — | — | All = 0 |
| 2 | V2 | "Inbound leads per month" | Acquisition | "0-9" | "10-24" | "25-49", "50+", "Not sure" |
| 3 | V3 | "First response time to new lead" | Conversion | "3+ days" | "1-2 days" | "Within 15 min", "1 hour", "Same day", "Not sure" |
| 4 | V4 | "Show rate %" | Conversion | "Under 40%" | "40-59%" | "80%+", "60-79%", "Not sure" |
| 5 | V5 | "Lead source concentration" | Acquisition | "Most leads from one source" | "Two sources" | "3+ sources", "Not sure" |
| 6 | A1 | "Reviews per month" | Acquisition | "0-5" | "6-10" | "11-15", "16-20", "Not sure" |
| 7 | C1 | "Who owns follow-up?" | Conversion | "No consistent owner" | "Varies" | Coordinator/Sales/Owner/Specialist, "Not sure" |
| 8 | C2 | "Days to first appointment" | Conversion | "15+ days" | "8-14 days" | "Same day", "1-2 days", "3-7 days", "Not sure" |
| 9 | C3 | "Biggest conversion blocker" | **MIXED** | See routing below | See routing below | "Not sure" = 0 |
| 10 | C4 | "Quote to close cycle" | Conversion | "90+ days" | "31-90 days" | "Same day"-"30 days", "Not sure" |
| 11 | R1 | "How often check in with past clients?" | Retention | "Rarely/Never" | "Yearly" | "Monthly", "Quarterly", "Twice/year", "Not sure" |
| 12 | R2 | "Existing-customer revenue trend" | Retention | "Shrunk" | "Flat" | "Grown", "Not sure" |
| 13 | R3 | "Revenue mix: new vs existing" | Retention | "Most from new customers" | "Roughly split" | "Most from existing", "Not sure" |

### C3 Special Routing

C3 is the only question that routes to different pillars based on the answer:

| C3 Answer | Pillar | Points |
|-----------|--------|--------|
| "Can't reach them / slow follow-up" | Conversion | +2 |
| "They ghost after the quote" | Conversion | +2 |
| "Price objections" | Conversion | +1 |
| "Not the right fit" | Acquisition | +1 |
| "Not sure" | — | 0 |

### Max Possible Points Per Pillar

- **Acquisition:** 6 base + C3 if "Not the right fit" (+1) = **7 max**
- **Conversion:** 10 base + C3 if speed/ghost (+2) or price (+1) = **12 or 11 max**
- **Retention:** always **6 max**

### Baseline Score Formula (LOCKED — do not change)

```
baseline_score = ROUND(100 × (winning_gap_total / max_possible_for_that_gap_given_C3), 0)
```

Must use the ACTUAL max for the winning gap given how C3 routed.

### Tie-Break Rules (applied in order when pillars tie)

1. **Conversion wins** if: V3 ∈ ["1-2 days", "3+ days"] OR V4 ∈ ["Under 40%", "40-59%"]
2. **Acquisition wins** if: V2 ∈ ["0-9", "10-24"] AND V5 ∈ ["Most leads...", "Two sources"]
3. **Retention wins** if: R1 ∈ ["Yearly", "Rarely/Never"] AND R3 ∈ ["Most new", "Roughly split"]
4. **V1 answer** as final fallback:
   - "Getting more leads (Acquisition)" → Acquisition
   - "Turning leads into booked work (Conversion)" → Conversion
   - "Getting repeats/referrals (Retention)" → Retention
   - "Not sure" → first alphabetically among tied

---

## 6. Quiz — Results & Sub-Diagnosis

**File:** `workers/mtg-quiz-webhook/src/results.js`

### Sub-Diagnosis Mapping

**If Acquisition:**
| Sub-Diagnosis | Trigger |
|---------------|---------|
| Demand shortfall | V2 ∈ ["0-9", "10-24"] |
| Channel concentration | V5 = "Most leads come from one source" |
| Lead quality mismatch | A1 ∈ ["0-5", "6-10"] |

Pick the one with highest contributing score. On tie, use the order above (demand > channel > quality).

**If Conversion:**
| Sub-Diagnosis | Trigger |
|---------------|---------|
| Speed-to-lead leak | V3 ∈ ["1-2 days", "3+ days"] |
| Ownership leak | C1 = "No consistent owner" |
| Booking friction | C2 ∈ ["8-14 days", "15+ days"] |
| Attendance leak | V4 ∈ ["Under 40%", "40-59%"] |
| Follow-up leak | C3 = "Can't reach them / slow follow-up" |
| Quote follow-up leak | C3 = "They ghost after the quote" (override: always wins over Attendance leak) |

**If Retention:**
| Sub-Diagnosis | Trigger |
|---------------|---------|
| No retention cadence | R1 ∈ ["Yearly", "Rarely/Never"] |
| Low compounding | R3 ∈ ["Most new", "Roughly split"] |
| At-risk base | R2 ∈ ["Flat", "Shrunk"] |

### Key Signals (for "Based on your answers" line)

Pick top 1-2 signals from +2-point answers. Examples:
- "your response time is over a day" (V3)
- "your show rate is under 60%" (V4)
- "most of your leads come from a single source" (V5)

### Cost-of-Leak Templates

| Primary Gap | Cost Text | Advice |
|-------------|-----------|--------|
| Acquisition | "Often 1-3 missed opportunities/month" | "If demand is the bottleneck, small changes can unlock a steady flow of qualified leads." |
| Conversion | "Often 10-30% of leads leak before booking" | "Most conversion gains come from speed, ownership, and follow-up." |
| Retention | "Often 10-25% revenue trapped in churn/no-repeat" | "Retention systems compound: repeats, reviews, and referrals." |

### Fastest Next Steps (shown on results page)

**Acquisition:**
- "Add one additional reliable lead source (so you're not dependent on a single channel)."
- "Improve lead fit by tightening your offer + ideal customer definition."

**Conversion:**
- "Set a first-response standard and assign one owner (so leads never 'float')."
- "Reduce time-to-meeting with a simple booking path and consistent follow-up."

**Retention:**
- "Create a simple review cadence (monthly or quarterly) with a clear owner."
- "Grow existing-customer revenue with a simple follow-up rhythm (and add a referral ask where it fits)."

---

## 7. Quiz — Eligibility Check

**File:** `workers/mtg-quiz-webhook/src/eligibility.js`

### Eligibility Criteria (ALL must pass)

| Check | Rule | Fail → Fix-First Reason |
|-------|------|-------------------------|
| Can share basic numbers | Count "Not sure" on 10 data Qs (V2, V3, V4, V5, A1, C2, C4, R1, R2, R3). If ≥5: fail | "No basic numbers available" |
| Has active demand/clients | V2 or R2 must be answered (not skipped) | "No active demand to work with" |
| Clarity check | If baseline_score = 0 AND ≥8 "Not sure" data answers: fail | "Offer/ideal customer is too unclear" |

If not eligible, `mtg_fix_first_reason` is written to HubSpot.

---

## 8. Quiz — JotForm & Webhook

### Quiz Page

**JotForm Form ID:** 260466844433158
**JotForm URL:** `https://form.jotform.com/260466844433158`
**Redirect stub:** `pages/quiz/index.html` → forwards to JotForm, preserving tracking params

The quiz is a JotForm card-layout form with 13 scoring questions + contact fields. JotForm is the source of truth for question wording and answer options. The old `/quiz/` URL redirects to JotForm so existing links keep working.

**Flow:** JotForm submit → JotForm thank-you auto-redirects to `/loading/?sid={submissionId}` → loading page polls worker → redirects to `/results/#base64data`

**Editing quiz wording:** Open the form in JotForm builder, click the question to edit. Answer option text must exactly match the values in `workers/shared/constants.js` (`SCORING_RULES`) or scoring breaks. See `docs/quiz-migration-plan.md` for the full "Eric's Cheat Sheet" of what lives where.

### Quiz Webhook

**Worker:** `mtg-quiz-webhook`
**URL:** `https://mtg-quiz-webhook.mindthegaps-biz-account.workers.dev`
**File:** `workers/mtg-quiz-webhook/src/index.js`

**Pipeline:**
1. Parse payload (form-encoded or JSON)
2. Extract contact info + quiz answers
3. Validate email
4. `scoreQuiz(answers)` → scoring result
5. `generateResults(scoringResult, answers)` → results content
6. `checkEligibility(scoringResult, answers)` → eligibility
7. Build HubSpot properties
8. Build scan prefill URL (`buildScanPrefillUrl()`) and include in HubSpot properties
9. Upsert Contact in HubSpot (non-blocking via `ctx.waitUntil()`)
10. Send notification email to Marc via Resend (non-blocking via `ctx.waitUntil()`)
11. Return JSON with `resultsUrl` (results data is base64-encoded in URL hash)

### Field Map (quiz page sends simple names)

| Quiz Page Field | Internal Key |
|-----------------|-------------|
| firstName | firstName |
| email | email |
| businessName | businessName |
| industry | industry |
| location | location |
| teamSize | teamSize |
| websiteUrl | websiteUrl |
| phone | phone |
| V1 through R3 | V1 through R3 |

---

## 9. Results Page

**File:** `pages/results/index.html`
**URL:** `https://mtg-pages-3yo.pages.dev/results/`

Static HTML/JS page. Reads base64-encoded results from the URL hash (`#`), decodes, and renders:
- Primary gap (with pillar-specific color: blue/green/orange)
- Sub-diagnosis
- Key signals ("Based on your answers...")
- Cost-of-leak estimate
- Fastest next steps
- Product info block: product name ("MindtheGaps 45-Minute Growth Scan"), price (CA$295.00), description
- CTA: "Book the 45-Minute Growth Gap Scan — CAD $295" → Stripe checkout

---

## 10. Payment — Stripe

**Worker:** `mtg-stripe-webhook`
**URL:** `https://mtg-stripe-webhook.mindthegaps-biz-account.workers.dev`

### Flow
1. Customer clicks Stripe payment link on results page
2. Stripe handles checkout ($295 CAD)
3. Stripe sends `checkout.session.completed` event to webhook
4. Worker verifies HMAC-SHA256 signature
5. Extracts: email, amount, currency, payment ID
6. Updates HubSpot: `mtg_payment_status=Paid`, amount, currency, payment ID, timestamp
7. Customer is redirected to booking page

### Secrets
- `HUBSPOT_API_KEY` — HubSpot private app token
- `STRIPE_WEBHOOK_SECRET` — Stripe signing secret

### Live Configuration (completed Mar 25, 2026)
- Results page uses live payment link: `https://buy.stripe.com/cNi3cwaRtgRMd9laYg1sQ00`
- After checkout, Stripe redirects to: `https://mtg-pages-3yo.pages.dev/booking/`
- Booking page embeds Marc's Calendly: `calendly.com/marc-tribeon/45-minute-growth-gap-scan`
- Test link preserved as comment in `pages/results/index.html` for future testing

---

## 11. Booking — Calendly

**Worker:** `mtg-calendly-webhook`
**URL:** `https://mtg-calendly-webhook.mindthegaps-biz-account.workers.dev`

### Flow
1. Customer picks a time on the booking page's Calendly widget
2. Calendly sends `invitee.created` event to webhook
3. Worker extracts: email, scheduled time, event URI
4. Updates HubSpot: `mtg_scan_booked=true`, scheduled time, event ID

### Booking Page
**File:** `pages/booking/index.html`
**URL:** `https://mtg-pages-3yo.pages.dev/booking/`

Embedded Calendly inline widget for Marc's 45-Minute Growth Gap Scan.

---

## 12. Scan Worksheet — JotForm Setup

**Form ID:** `260435948553162`
**JotForm API:** EU endpoint (`eu-api.jotform.com`)

### All Field QIDs

**Contact Info (prefilled from quiz):**
| QID | Field | Purpose |
|-----|-------|---------|
| q2 | contactEmail | Email address |
| q3 | scanFirstName | First name |
| q4 | scanBusinessName | Business name |
| q5 | scanIndustry | Industry dropdown |
| q6 | scanPhone | Phone number |

**Core Scan Fields:**
| QID | Field | Purpose |
|-----|-------|---------|
| q7 | quizPrimaryGap | Primary gap from quiz (prefilled, read-only) |
| q9 | primaryGap | Confirmed primary gap (facilitator selects) |
| q10 | gapChangeReason | Why gap changed (conditional: shown when q9 ≠ q7) |
| q79 | contradictionNote | Optional contradiction note (max 120 chars) |

**Sub-Path (one per pillar, conditional on q9):**
| QID | Field | Shown When |
|-----|-------|------------|
| q11 | subPathConversion | q9 = Conversion |
| q12 | subPathAcquisition | q9 = Acquisition |
| q13 | subPathRetention | q9 = Retention |

**Field 2 Follow-ups (one per sub-path, conditional):**
| QID | Sub-Path | Label |
|-----|----------|-------|
| q80 | Speed-to-lead | First response time |
| q81 | Booking friction | Days to first appointment |
| q82 | Show rate | Show rate % |
| q83 | Quote follow-up | Quote-to-close % |
| q84 | Channel concentration risk | % leads from top source |
| q85 | Lead capture friction | Calls answered live |
| q86 | Demand capture / local visibility | Inbound leads per month (0-9, 10-24, 25-49, 50+, Not sure — aligned to quiz) |
| q87 | Rebook/recall gap | Next step scheduled at job end |
| q88 | Referral ask gap | Referral intros per month |
| q89 | Post-service follow-up gap | % revenue from repeat |

**One Lever (one per pillar, conditional on q9):**
| QID | Field |
|-----|-------|
| q36 | oneLeverConversion |
| q37 | oneLeverAcquisition |
| q38 | oneLeverRetention |
| q39 | oneLeverSentence (hidden, pre-populated) |

**Baseline Fields (Tier-1, all required in JotForm):**
All 20 baseline fields (7 Conv + 7 Acq + 6 Ret) are set to `required=Yes` in JotForm. Each includes a "Not sure" option so required never blocks progress. This prevents incomplete baseline data from triggering stop rule 3.

*Conversion (7 fields):*
| QID | Internal Key | Label |
|-----|-------------|-------|
| q15 | conv_inbound_leads | Inbound leads per month |
| q16 | conv_first_response_time | First response time |
| q17 | conv_lead_to_booked | Lead to booked % |
| q18 | conv_booked_to_show | Booked to show % |
| q19 | conv_time_to_first_appointment | Time to first appointment |
| q20 | conv_quote_sent_timeline | Quote sent timeline |
| q21 | conv_quote_to_close | Quote to close % |

*Acquisition (7 fields):*
| QID | Internal Key | Label |
|-----|-------------|-------|
| q22 | acq_inbound_leads | Inbound leads per month |
| q23 | acq_top_source_dependence | Top source dependence |
| q24 | acq_pct_from_top_source | % leads from top source |
| q25 | acq_calls_answered_live | Calls answered live % |
| q26 | acq_website_capture_friction | Website capture friction |
| q27 | acq_reviews_per_month | Reviews per month |
| q28 | acq_referral_intros_per_month | Referral intros per month |

*Retention (6 fields):*
| QID | Internal Key | Label |
|-----|-------------|-------|
| q29 | ret_pct_revenue_repeat | % revenue from repeat |
| q30 | ret_pct_revenue_referrals | % revenue from referrals |
| q31 | ret_rebook_scheduling | Rebook/next-step scheduling |
| q32 | ret_reviews_per_month | Reviews per month |
| q33 | ret_follow_up_time | Follow-up time after service |
| q34 | ret_check_in_rhythm | Check-in rhythm |

**Actions (6 slots — shared fields):**
| QID Range | Fields |
|-----------|--------|
| q41-q43 | Action 1: description, owner, due date |
| q44-q46 | Action 2: description, owner, due date |
| q47-q49 | Action 3: description, owner, due date |
| q50-q52 | Action 4: description, owner, due date |
| q53-q55 | Action 5: description, owner, due date |
| q56-q58 | Action 6: description, owner, due date |

**Per-Sub-Path Owner Fields (override shared owners):**
| QID Range | Sub-Path |
|-----------|----------|
| q194-q199 | Channel concentration risk (A1) |
| q200-q205 | Lead capture friction (A2) |
| q206-q211 | Demand capture / local visibility (A3) |
| q212-q217 | Lead tracking + ownership gap (A4) |
| q218-q223 | Speed-to-lead (C1) |
| q224-q229 | Booking friction (C2) |
| q230-q235 | Show rate (C3) |
| q236-q241 | Quote follow-up / decision drop-off (C4) |
| q242-q247 | Stage clarity + follow-up consistency gap (C5) |
| q248-q253 | Rebook/recall gap (R1) |
| q254-q259 | Review rhythm gap (R2) |
| q260-q265 | Referral ask gap (R3) |
| q266-q271 | Post-service follow-up gap (R4) |
| q272-q277 | Value review / renewal alignment gap (R5) |

**Predetermined Action Description Fields (locked dropdowns):**
| QID Range | Sub-Path | Fields |
|-----------|----------|--------|
| q95-q100 | A1 (Channel concentration risk) | 6 action descriptions |
| q101-q106 | A2 (Lead capture friction) | 6 action descriptions |
| q107-q112 | A3 (Demand capture / local visibility) | 6 action descriptions |
| q113-q118 | A4 (Lead tracking + ownership gap) | 6 action descriptions |
| q119-q124 | C1 (Speed-to-lead) | 6 action descriptions |
| q125-q130 | C2 (Booking friction) | 6 action descriptions |
| q131-q136 | C3 (Show rate) | 6 action descriptions |
| q137-q142 | C4 (Quote follow-up) | 6 action descriptions |
| q143-q148 | C5 (Stage clarity + follow-up consistency gap) | 6 action descriptions |
| q149-q154 | R1 (Rebook/recall gap) | 6 action descriptions |
| q155-q160 | R2 (Review rhythm gap) | 6 action descriptions |
| q161-q166 | R3 (Referral ask gap) | 6 action descriptions |
| q167-q172 | R4 (Post-service follow-up gap) | 6 action descriptions |
| q173-q178 | R5 (Value review / renewal alignment gap) | 6 action descriptions |

**"What We Fix" Fields (one per sub-path):**
q179-q192 (one per sub-path, same order as above)

**Metrics (one checkbox field per pillar):**
| QID | Pillar |
|-----|--------|
| q60 | Conversion metrics: Median response time, Lead to booked %, Show rate %, Quote sent within 48h % |
| q61 | Acquisition metrics: Leads/week, % leads from top source, Calls answered live %, Median response time, Reviews/week, Referral intros/week, Leads to booked % |
| q62 | Retention metrics: Rebook rate (or count), Reviews/week, Referral intros/week, Days to follow-up after service, Repeat revenue band |

**Per-Action Facilitator Notes (optional, 6 shared fields shown on all sub-paths):**
| QID | Field | Order | Purpose |
|-----|-------|-------|---------|
| q279 | actionNote1 | 314.5 | Optional note for Action 1, renders inline in DOCX as "Facilitator note: {text}" |
| q280 | actionNote2 | 345.5 | Optional note for Action 2 |
| q281 | actionNote3 | 376.5 | Optional note for Action 3 |
| q282 | actionNote4 | 407.5 | Optional note for Action 4 |
| q283 | actionNote5 | 438.5 | Optional note for Action 5 |
| q284 | actionNote6 | 469.5 | Optional note for Action 6 |

Helper text: "Use only if the client says something specific we want reflected in the plan."
q278 (old single ICP note) is hidden but preserved for historical data.

**Constraints:**
| QID | Field |
|-----|-------|
| q64 | constraint1 |
| q65 | constraint2 |
| q66 | constraint3 |

---

## 13. Scan Webhook — Processing Pipeline

**Worker:** `mtg-scan-webhook`
**URL:** `https://mtg-scan-webhook.mindthegaps-biz-account.workers.dev`
**File:** `workers/mtg-scan-webhook/src/index.js`

### Pipeline (10 steps)

1. **Parse payload** — handles form-encoded, JSON, and JotForm rawRequest
2. **Extract contact info** — email, name, business, industry, phone (handles JotForm phone object)
3. **Extract scan data** — primary gap, sub-path, baseline fields, actions, metrics, constraints
4. **Validate email** — normalize + validate format
5. **Lookup HubSpot** — get existing contact data (business name, industry from quiz) for enrichment
6. **Run stop rules** — 5 checks (see section 14)
   - If stopped → write to HubSpot + notify Marc → return early
7. **Calculate confidence** — count "Not sure" answers → High/Med/Low
8. **Generate plan** — deterministic lookup tables (see section 16)
9. **Build DOCX** — One-Page Plan document (see section 17)
10. **Upload to R2** — store at `plans/{email}/{timestamp}.docx`
11. **Write to HubSpot** — all 79 properties including action data + per-action notes
12. **Email Marc** — via Resend (plan ready, degraded, or stop notification)
13. **Return JSON** — success response with plan URL

### Also Serves: DOCX Downloads

`GET /plans/{email}/{timestamp}.docx` → serves DOCX from R2 with correct Content-Type.

---

## 14. Stop Rules Engine

**File:** `workers/mtg-scan-webhook/src/stopRules.js`

### 4 Stop Rules (plan generation halted if ANY are true)

| # | Rule | Condition | Result |
|---|------|-----------|--------|
| 1a | Sub-path = "not sure" | Sub-path value is "not sure" (case-insensitive) | Full stop |
| 1c | Field 2 = "not sure" | Field 2 follow-up answer is "not sure" | Full stop |
| 2 | Gap changed without reason | q9 ≠ q7 AND gapChangeReason is empty | Full stop |
| 3 | Missing required fields | Any of: no primary gap, no sub-path, no one lever, <5 non-"Not sure" baseline answers, <6 actions, <2 metrics | Full stop |

Note: Rule 1b ("Other" sub-path = full stop) was **removed Mar 20, 2026**. "Lead tracking + ownership gap" (A4), "Stage clarity + follow-up consistency gap" (C5), and "Value review / renewal alignment gap" (R5) now generate plans normally using predetermined lookup tables.

### Output

```javascript
{
  stopped: boolean,      // true = no plan generated
  degraded: boolean,     // true = plan generated but flagged
  reasons: string[],     // human-readable messages
  details: [{ rule, message }]
}
```

### When Stopped
- `mtg_scan_stop_reason` = reasons joined with " | "
- `mtg_plan_review_status` = "Manual Required"
- `mtg_plan_generation_mode` = "Stopped"
- Marc gets red-header "🛑 Scan Stopped" email

### When Degraded
- Plan IS generated
- `mtg_plan_review_status` = "Manual Required"
- `mtg_plan_generation_mode` = "Degraded"
- Marc gets amber-header "⚠️ Degraded Plan" email

---

## 15. Confidence Calculator

**File:** `workers/mtg-scan-webhook/src/confidence.js`

### Levels

| "Not sure" Count | Level | Plan Impact |
|-------------------|-------|-------------|
| 0-1 | High | Constraints section optional |
| 2-3 | Med | Must include ≥1 constraint row |
| ≥4 | Low | Must include constraints + "Data gaps to measure" box |

### What Counts

Counts "Not sure" answers only in Tier-1 baseline fields for the confirmed primary gap pillar (7 fields for Conversion/Acquisition, 6 for Retention).

### Output

```javascript
{
  level: 'High' | 'Med' | 'Low',
  notSureCount: number,
  totalFields: number,
  answeredCount: number,
  includeConstraints: boolean,  // true if Med or Low
  includeDataGaps: boolean      // true if Low only
}
```

---

## 16. Plan Generator — Lookup Tables

**File:** `workers/mtg-scan-webhook/src/planGenerator.js`

### This is 100% deterministic — NO AI

**Pass-through architecture (April 2026):** Action descriptions and one-liners now prefer form-submitted values from JotForm's locked dropdown fields (q95-q178 for actions, q179-q192 for one-liners). The lookup tables in planGenerator.js are fallbacks only. This means wording changes can be made in JotForm alone — no code edits or deployments required. Helper narration (sublabels) is JotForm-only and was never used in plan output.

The plan generator uses three lookup tables and computed rules:

### Lookup Table 1: PREDETERMINED_ACTIONS

Maps each sub-path to exactly 6 actions with default owners and due dates. The source of truth is `docs/MTG_Action_Ladder_Reference_v2.xlsx`.

**11 predetermined sub-paths:**
- Channel concentration risk (6 actions)
- Lead capture friction (6 actions)
- Demand capture / local visibility (6 actions)
- Speed-to-lead (6 actions)
- Booking friction (6 actions)
- Show rate (6 actions)
- Quote follow-up / decision drop-off (6 actions)
- Rebook/recall gap (6 actions)
- Review rhythm gap (6 actions)
- Referral ask gap (6 actions)
- Post-service follow-up gap (6 actions)

"Lead tracking + ownership gap" (A4), "Stage clarity + follow-up consistency gap" (C5), and "Value review / renewal alignment gap" (R5) also have predetermined actions in the lookup table and generate plans normally.

### Lookup Table 2: STEP5_WHAT_WE_FIX

Maps each sub-path to the "What we fix first" statement for Section C of the plan.

### Lookup Table 3: Range Progressions

Baseline answer ranges ordered worst→best. The 30-day target = next range up. If already at best, stays.

Examples:
```
conv_first_response_time: ['3+ days', '1-2 days', 'Same day', '<1 hour']
acq_top_source_dependence: ['1 source', '2 sources', '3-4 sources', '5+ sources']
ret_pct_revenue_repeat: ['0-20%', '21-40%', '41-60%', '61%+']
```

### Owner Priority

Per-sub-path owner fields (q194-q277) override shared owner fields (q42, q45, etc.). If per-sub-path is empty, falls back to shared.

### Plan Output Shape

```javascript
{
  sectionA: { opener, contradictionNote, subDiagnosis, supportingSignal, basedOnYourAnswers, manualPlanFlag },
  sectionB: { rows: [{ label, value }] },              // Baseline
  sectionC: { leverName, whatWeFixFirst, whatDoneLooksLike, primaryMetric, thirtyDayTarget },
  sectionD: { actions: [{ description, owner, dueDate }] },  // 6 actions
  sectionE: { metrics: [{ name, baseline, thirtyDayTarget }] },
  sectionF: { constraints: [], dataGapsText }
}
```

---

## 17. DOCX Builder — One-Page Plan

**File:** `workers/mtg-scan-webhook/src/docxBuilder.js`
**Dependency:** `docx` npm package

### 6 Sections

| Section | Content | Source |
|---------|---------|--------|
| A) What We Found | Opener sentence, sub-diagnosis, supporting signal, key signals | sectionA |
| B) Baseline | Table of Tier-1 baseline fields (non-"Not sure" only) | sectionB |
| C) One Lever | Lever name, "what we fix first", "what done looks like", primary metric, 30-day target | sectionC |
| D) Action Plan | 6-row table: Action, Owner, Due Date | sectionD |
| E) Weekly Scorecard | 2-4 metrics: name, baseline value, 30-day target | sectionE |
| F) Risks & Constraints | Conditional on confidence. Med/Low: ≥1 constraint. Low: also "Data gaps to measure" | sectionF |

### Special Features
- Contradiction note (Section A) -- yellow highlight, red text, if present
- Manual plan flag (Section A) -- bold warning for degraded plans
- Confidence badge -- shown in header area
- Per-action facilitator notes (Section D) -- "Facilitator note: {text}" rendered in italics under each action row, only if non-empty (q279-q284)

---

## 18. Email Notifications — Resend

**File:** `workers/mtg-scan-webhook/src/notifications.js`

All JotForm emails are disabled. Notifications are sent exclusively via Resend from the scan webhook.

### Three Email Types

| Type | When | Subject | Header Color |
|------|------|---------|-------------|
| Plan Ready | Normal plan generated | "Plan draft ready: {business}" | Blue |
| Degraded Plan | Reserved for future use | "⚠️ Degraded plan draft — human review required: {business}" | Amber |
| Stop Rule | Any stop rule fired | "🛑 Manual plan required: {business}" | Red |

### Email Content

All emails include a styled HTML scan summary:
- Contact info (name, business, industry, phone)
- Scan diagnosis (primary gap, sub-path, one lever, field 2, gap change details)
- Baseline answers (non-empty, non-"Not sure" only)
- Action plan table (6 actions with owner + due date) — plan ready/degraded only
- Selected metrics
- Constraints

### Configuration

| Variable | Default |
|----------|---------|
| RESEND_API_KEY | (required — silently skips if missing) |
| FROM_EMAIL | `MindtheGaps <notifications@mindthegaps.biz>` |
| MARC_EMAIL | `marc@mindthegaps.biz` |

---

## 19. HubSpot — All 80 Properties

All properties use the `mtg_` prefix, live in the "mindthegaps" property group, and are on Contact records only. No Deals pipeline.

### Profile Fields (8)
| Property | Type |
|----------|------|
| mtg_first_name | text |
| mtg_business_name | text |
| mtg_industry | dropdown |
| mtg_location | dropdown |
| mtg_team_size | dropdown |
| mtg_website_url | text |
| mtg_phone | phone |
| mtg_fix_first_reason | text |

### Quiz Output (15)
| Property | Type | Written By |
|----------|------|------------|
| mtg_quiz_completed | checkbox | Quiz webhook |
| mtg_quiz_completed_at | datetime | Quiz webhook |
| mtg_primary_gap | dropdown (Acquisition/Conversion/Retention) | Quiz webhook |
| mtg_quiz_score | number (0-100) | Quiz webhook |
| mtg_sub_diagnosis | dropdown | Quiz webhook |
| mtg_key_signals | text | Quiz webhook |
| mtg_gap_causes | text | Quiz webhook |
| mtg_action_suggestions | text | Quiz webhook |
| mtg_cost_of_leak | text | Quiz webhook |
| mtg_scan_eligible | checkbox | Quiz webhook |
| mtg_quiz_v1 through mtg_quiz_r3 | dropdown (14 properties) | Quiz webhook |

### Payment Fields (5)
| Property | Type | Written By |
|----------|------|------------|
| mtg_payment_status | dropdown | Stripe webhook |
| mtg_payment_amount | number | Stripe webhook |
| mtg_payment_currency | text | Stripe webhook |
| mtg_payment_date | datetime | Stripe webhook |
| mtg_stripe_payment_id | text | Stripe webhook |

### Booking Fields (4)
| Property | Type | Written By |
|----------|------|------------|
| mtg_scan_booked | checkbox | Calendly webhook |
| mtg_scan_booked_at | datetime | Calendly webhook |
| mtg_scan_scheduled_for | datetime | Calendly webhook |
| mtg_calendly_event_id | text | Calendly webhook |

### Scan Output (16)
| Property | Type | Written By |
|----------|------|------------|
| mtg_scan_completed | checkbox | Scan webhook |
| mtg_scan_completed_at | datetime | Scan webhook |
| mtg_scan_primary_gap_confirmed | dropdown | Scan webhook |
| mtg_scan_sub_path | text | Scan webhook |
| mtg_scan_one_lever | text | Scan webhook |
| mtg_scan_one_lever_sentence | text | Scan webhook |
| mtg_scan_confidence | dropdown (High/Med/Low) | Scan webhook |
| mtg_confidence_not_sure_count | number | Scan webhook |
| mtg_scan_stop_reason | text | Scan webhook |
| mtg_scan_field2_answer | text | Scan webhook |
| mtg_scan_action1_note | textarea | Scan webhook (optional facilitator note for action 1) |
| mtg_scan_action2_note | textarea | Scan webhook (optional facilitator note for action 2) |
| mtg_scan_action3_note | textarea | Scan webhook (optional facilitator note for action 3) |
| mtg_scan_action4_note | textarea | Scan webhook (optional facilitator note for action 4) |
| mtg_scan_action5_note | textarea | Scan webhook (optional facilitator note for action 5) |
| mtg_scan_action6_note | textarea | Scan webhook (optional facilitator note for action 6) |
| mtg_scan_prefill_url | text (URL) | Quiz webhook |

### Plan Fields (8)
| Property | Type | Written By |
|----------|------|------------|
| mtg_plan_draft_link | text (URL) | Scan webhook |
| mtg_plan_drafted_at | datetime | Scan webhook |
| mtg_plan_status | dropdown (Draft/Reviewed/Sent) | Scan webhook |
| mtg_plan_review_status | dropdown (Pending/Approved/Rejected/Manual Required) | Scan webhook |
| mtg_plan_reviewer_notes | text | Manual |
| mtg_plan_sent_at | datetime | Manual |
| mtg_plan_generation_mode | dropdown (Auto/Stopped/Degraded) | Scan webhook |
| mtg_final_plan | text (URL) | Manual (Google Drive link to final reviewed One-Page Plan) |

### Action Fields (18)
| Property | Type | Written By |
|----------|------|------------|
| mtg_scan_action1_desc through mtg_scan_action6_desc | text | Scan webhook |
| mtg_scan_action1_owner through mtg_scan_action6_owner | text | Scan webhook |
| mtg_scan_action1_due through mtg_scan_action6_due | text | Scan webhook |

### Setup Script

```bash
HUBSPOT_API_KEY=pat-xxx node scripts/setup-hubspot-properties.js
```

Creates all properties. Safe to re-run (skips existing).

---

## 20. R2 Storage — Plan Drafts

| Setting | Value |
|---------|-------|
| Bucket name | `mtg-plan-drafts` |
| Key format | `plans/{email}/{timestamp}.docx` |
| Access | Via GET on scan webhook worker |
| Content-Type | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

---

## 21. Cloudflare Workers — Deployment

### Deployed Workers

| Worker | URL | Purpose |
|--------|-----|---------|
| mtg-quiz-webhook | `https://mtg-quiz-webhook.mindthegaps-biz-account.workers.dev` | Quiz scoring + HubSpot |
| mtg-stripe-webhook | `https://mtg-stripe-webhook.mindthegaps-biz-account.workers.dev` | Payment confirmation |
| mtg-calendly-webhook | `https://mtg-calendly-webhook.mindthegaps-biz-account.workers.dev` | Booking confirmation |
| mtg-scan-webhook | `https://mtg-scan-webhook.mindthegaps-biz-account.workers.dev` | Scan → plan → email |

### Pages

| Project | URL |
|---------|-----|
| mtg-pages | `https://mtg-pages-3yo.pages.dev` |
| Quiz | `/quiz/` |
| Results | `/results/` |
| Booking | `/booking/` |

### Deploy Commands

```bash
# Deploy a worker
cd workers/mtg-scan-webhook && npx wrangler deploy

# Deploy pages
npx wrangler pages deploy pages/ --project-name mtg-pages --branch main

# Set a secret
cd workers/mtg-scan-webhook && echo "value" | npx wrangler secret put SECRET_NAME
```

All workers use:
- `compatibility_date = "2024-09-23"`
- `compatibility_flags = ["nodejs_compat"]`
- Module format (ESM entry point → CJS handler)

---

## 22. JotForm Conditional Logic (40 Rules)

The scan worksheet has 40 conditional logic rules. These are configured via JotForm API and are destructive-write (writing `properties[conditions]` REPLACES ALL existing conditions).

### Rules 1-3: Pillar Visibility
Based on q9 (Confirmed Primary Gap), show/hide pillar-specific fields:
- Baseline fields per pillar
- Metrics per pillar
- Sub-path dropdown per pillar
- Cross-pillar predetermined fields

### Rules 4-12: Gap Change Reason
Based on q9 vs q7 (quiz gap vs confirmed gap), show/hide q10 (gap change reason field). 9 combinations (3 quiz gaps × 3 confirmed gaps where they differ).

### Rules 13-26: Sub-Path Ladder Fields
Based on q11/q12/q13 (sub-path selection), hide legacy Action Ladder summary cards.

### Rules 27-40: Predetermined Show/Hide + Owners + Field 2
Based on q11/q12/q13, show the selected sub-path's action cards (q95-q178), what-we-fix dropdown (q179-q192), per-sub-path owner fields (q194-q277), and Field 2 diagnostic question -- while hiding all other sub-paths' fields.

### Authoritative Copy
`scratchpad/restore_all_conditions.js` contains the full 40-condition set. Always use this as reference. See also `docs/MTG_JotForm_Conditions_Cheatsheet.xlsx` for a human-readable map of which condition controls which sub-path.

---

## 23. JotForm API Gotchas

### Destructive Writes
- `properties[conditions]` — REPLACES ALL conditions. Always read first, merge, then write.
- `properties[emails]` — REPLACES ALL emails. Use indexed format: `properties[emails][0][key]=value`.

### Dropdown Options Bug
When creating `control_dropdown` via API with `question[options]`, JotForm splits a bare string character-by-character. Use pipe-delimited format: `"Option1|Option2"`.

### EU Endpoint
Always use `eu-api.jotform.com` (not `api.jotform.com`).

### Phone Object
JotForm sends phone as `{area: "555", phone: "1234567"}` object, not a string. Must be parsed.

### Hidden Fields Default
Conditional fields default to `hidden: "No"`. Preview mode ignores this but live mode respects it. Set `hidden: "Yes"` on fields that should be hidden by default.

---

## 24. Testing

### 575 Tests — All Passing

```bash
npm test                     # Run all 578 tests
npm run test:scoring         # Scoring engine (51)
npm run test:results         # Results generator (29)
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

Requires Node 18+. Uses built-in `node:test` runner. Only external dependency: `docx`.

### QA Test Scripts

Full E2E test scripts are in `docs/MindtheGaps_QA_Test_Scripts_Complete_v3.md` covering:
- A1: Channel concentration risk (Acquisition)
- C1: Speed-to-lead (Conversion with pillar switch)
- R1: Rebook/recall gap (Retention with pillar switch)
- M1: Lead tracking + ownership gap (Acquisition) — plan generated
- M2: Stage clarity + follow-up consistency gap (Conversion) — plan generated
- Plus additional scripts for other sub-paths

---

## 25. Critical Business Rules

| Rule | Details |
|------|---------|
| **Contact dedup** | Always upsert by email. Never create duplicate HubSpot Contacts. |
| **No sensitive data** | All quiz/scan fields use ranges/selects, never exact numbers. |
| **DOCX only** | Never generate PDFs. Always DOCX. |
| **Human-in-the-loop** | Plans are NEVER auto-sent to clients. Marc reviews within 24 hours. |
| **Deterministic plans** | No AI/LLM in plan generation. Lookup tables only. |
| **Stop rules halt generation** | Any of 4 rules → no plan, Marc notified. |
| **Renamed sub-paths generate plans** | A4 ("Lead tracking + ownership gap"), C5 ("Stage clarity + follow-up consistency gap"), R5 ("Value review / renewal alignment gap") flow through to plan generation using predetermined lookup tables. |
| **Baseline formula locked** | `ROUND(100 × (gap_total / max_possible), 0)` — do not change. |
| **Predetermined actions** | For non-manual sub-paths, descriptions come from JotForm locked dropdowns (pass-through). Lookup tables in planGenerator.js are fallbacks. Wording changes only need JotForm edits. |
| **Owner override** | Per-sub-path owner fields (q194-q277) take precedence over shared owner fields. |
| **Non-blocking writes** | All HubSpot writes use `ctx.waitUntil()`. Customer response returns immediately. |
| **JotForm conditions are destructive** | Always read existing conditions before writing. |
| **`mtg_` property prefix** | All HubSpot properties start with `mtg_` in the "mindthegaps" group. |

---

## Where Things Live (Eric's Reference)

This system has two layers: **JotForm** (forms Marc/Eric can edit) and **Cloudflare** (code + infrastructure that Tyler deployed). Here's what lives where.

### JotForm (edit in browser, no code needed)

| Form | Form ID | What it does |
|------|---------|-------------|
| Quiz | 260466844433158 | 13-question growth gap quiz. Question wording, answer options, helper text, branding -- all editable in JotForm builder. |
| Scan Worksheet | 260435948553162 | 45-minute facilitator worksheet. Action card wording (helper narration + locked text), one-liners, owner defaults -- all editable in JotForm builder. |

**What you can safely change in JotForm:**
- Question text / wording
- Helper text (descriptions on cards)
- Answer option labels (⚠️ quiz options must exactly match the scoring engine values or scoring breaks -- see `workers/shared/constants.js`)
- Form styling / theme
- Welcome page and thank-you page text

**What you should NOT change in JotForm without a developer:**
- Field names (e.g. `quiz_V1`) -- the webhook uses these to map answers
- Webhook URL (Settings > Integrations) -- this is how JotForm talks to Cloudflare
- Thank-you redirect URL -- this controls the loading page flow
- Conditional logic rules on the scan worksheet -- destructive-write risk

### Cloudflare (code, requires deployment)

All the "smart" logic lives in Cloudflare Workers. These are small JavaScript programs that run when JotForm sends a webhook.

| Service | What it does | When Eric might need it |
|---------|-------------|----------------------|
| **mtg-quiz-webhook** (Worker) | Receives quiz submission, scores it, writes HubSpot, generates results page URL, sends emails | Change scoring rules, sub-diagnosis text, cost-of-leak text, eligibility thresholds, results email wording |
| **mtg-scan-webhook** (Worker) | Receives scan submission, runs stop rules, generates plan, builds DOCX, uploads to R2, emails Marc | Change plan template, stop rules, confidence thresholds, action fallback text |
| **mtg-stripe-webhook** (Worker) | Receives Stripe payment confirmation, updates HubSpot payment status | Rarely needs changes |
| **mtg-calendly-webhook** (Worker) | Receives Calendly booking confirmation, updates HubSpot booking status | Rarely needs changes |
| **Cloudflare Pages** (static hosting) | Hosts the results page, loading page, landing page, booking page | Change results page layout, loading page design |
| **Cloudflare R2** (file storage) | Stores generated DOCX plan files | Never needs manual changes |
| **Cloudflare KV** (cache) | Temporarily stores quiz results for the loading page to poll (1-hour TTL) | Never needs manual changes |

**Where the code files live:**
```
workers/
  mtg-quiz-webhook/src/
    index.js          -- main handler, JotForm field mapping
    scoring.js        -- scoring engine (pure math, no side effects)
    results.js        -- sub-diagnosis text, cost-of-leak, next steps
    eligibility.js    -- scan eligibility check
    quizEmail.js      -- results email + Marc notification + scan prefill URL builder
  mtg-scan-webhook/src/
    index.js          -- main handler, JotForm field mapping
    planGenerator.js  -- lookup tables (actions, one-liners, helper narration fallbacks)
    stopRules.js      -- stop rule engine
    confidence.js     -- confidence calculator
    docxBuilder.js    -- DOCX plan file builder
    storage.js        -- R2 upload
    notifications.js  -- Resend email sender
  shared/
    constants.js      -- scoring rules, question IDs, pillar definitions
    hubspot.js        -- HubSpot API client
    validation.js     -- email validation
pages/
  quiz/index.html     -- redirect stub (forwards to JotForm quiz)
  results/index.html  -- results page (reads base64 data from URL hash)
  loading/index.html  -- loading spinner (polls worker for results)
  landing/index.html  -- marketing landing page
  booking/index.html  -- Calendly booking embed
```

**To deploy code changes:**
```bash
cd workers/mtg-quiz-webhook && npx wrangler@3 deploy    # quiz worker
cd workers/mtg-scan-webhook && npx wrangler@3 deploy    # scan worker
npx wrangler pages deploy pages/ --project-name mtg-pages --branch main  # static pages
```

### How JotForm and Cloudflare Connect

```
User fills JotForm quiz
  → JotForm sends webhook POST to mtg-quiz-webhook (Cloudflare Worker)
  → Worker scores quiz, writes HubSpot, stores results in KV cache
  → JotForm redirects user to /loading/?sid={submissionId}
  → Loading page polls the worker for results
  → Worker returns resultsUrl from KV cache
  → Browser redirects to /results/#base64data
  → Results page decodes and renders everything client-side
```

### Secrets (API keys stored in Cloudflare, never in code)

Secrets are set via `wrangler secret put` and are NOT in the GitHub repo. They take effect immediately without redeployment.

```bash
# To view which secrets are set (not their values):
cd workers/mtg-quiz-webhook && npx wrangler@3 secret list

# To update a secret:
echo "new-value" | npx wrangler@3 secret put SECRET_NAME
```

---

## Repo Structure

```
MindTheGaps/
├── CLAUDE.md                    # AI assistant context
├── PROJECT_CONTEXT.md           # Complete technical spec
├── README.md                    # Project status + changelog
├── package.json
│
├── pages/
│   ├── quiz/index.html          # Redirect stub → JotForm quiz (260466844433158)
│   ├── results/index.html       # Results page (reads base64 from URL hash)
│   ├── booking/index.html       # Calendly booking widget
│   ├── landing/index.html       # Marketing landing page
│   └── scan/index.html          # Scan booking page
│
├── workers/
│   ├── shared/
│   │   ├── constants.js         # All enums, scoring rules, thresholds
│   │   ├── hubspot.js           # HubSpot API client
│   │   └── validation.js        # Email validation, sanitization
│   │
│   ├── mtg-quiz-webhook/src/
│   │   ├── worker.js            # ESM entry
│   │   ├── index.js             # Quiz handler
│   │   ├── scoring.js           # Scoring engine
│   │   ├── results.js           # Results generator
│   │   ├── eligibility.js       # Eligibility check
│   │   └── quizEmail.js         # Marc notification email + scan prefill URL builder
│   │
│   ├── mtg-stripe-webhook/src/
│   │   ├── worker.js
│   │   └── index.js             # Stripe signature verify → HubSpot
│   │
│   ├── mtg-calendly-webhook/src/
│   │   ├── worker.js
│   │   └── index.js             # Calendly webhook → HubSpot
│   │
│   └── mtg-scan-webhook/src/
│       ├── worker.js            # ESM entry
│       ├── index.js             # Main orchestrator
│       ├── stopRules.js         # 5 stop conditions
│       ├── confidence.js        # Not-sure count → confidence level
│       ├── planGenerator.js     # Deterministic plan generation
│       ├── docxBuilder.js       # DOCX file builder
│       ├── storage.js           # R2 upload
│       └── notifications.js     # Resend email to Marc
│
├── scripts/
│   ├── setup-hubspot-properties.js
│   └── setup-calendly-webhook.js
│
├── tests/                       # 578 tests (node:test runner)
│
└── docs/
    ├── REBUILD_GUIDE.md         # THIS FILE
    ├── MTG_Action_Ladder_Reference_v2.xlsx  # Source of truth for actions
    ├── MindtheGaps_QA_Test_Scripts_Complete_v3.md
    └── industry-refinement-notes.md
```
