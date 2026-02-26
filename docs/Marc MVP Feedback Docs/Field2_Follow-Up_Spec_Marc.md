# Field 2 Follow-Up Questions — Marc's Specification

**Received:** 2026-02-26
**From:** Marc (via email)
**Implemented:** 2026-02-26

---

## Intent

One follow-up question per sub-path (not per gap). The flow is:

1. Facilitator picks the Primary Gap
2. Facilitator picks the Section 2B sub-path
3. JotForm then shows one short Field 2 follow-up question tied to that specific sub-path

The follow-up:
- Gives a concrete supporting data point for the plan
- Helps confirm the sub-path choice
- If the answer clearly contradicts the original sub-path, the facilitator can choose the better-fit sub-path and add a short note

## Mappings

### Conversion

| Sub-Path | Follow-Up Label | Options |
|---|---|---|
| Speed-to-lead | First response time | Same day / 1 day / 1-2 days / 3+ days / Not sure |
| Booking friction | Days to first appointment | 0-2 / 3-7 / 8-14 / 15+ / Not sure |
| Show rate | Show rate % | <60% / 60-79% / 80-89% / 90%+ / Not sure |
| Quote follow-up / decision drop-off | Quote-to-close % | 0-20% / 21-40% / 41-60% / 61%+ / Not sure |

### Acquisition

| Sub-Path | Follow-Up Label | Options |
|---|---|---|
| Channel concentration risk | % leads from top source | 0-40% / 41-60% / 61-80% / 81%+ / Not sure |
| Lead capture friction | Calls answered live | Always / Often / Sometimes / Rarely / Not sure |
| Demand capture / local visibility | Inbound leads per month | 0-10 / 11-25 / 26-50 / 51+ / Not sure |

### Retention

| Sub-Path | Follow-Up Label | Options |
|---|---|---|
| Rebook/recall gap | Next step scheduled at job end | Always / Often / Sometimes / Rarely / Not sure |
| Referral ask gap | Referral intros per month | 0 / 1-2 / 3-5 / 6+ / Not sure |
| Post-service follow-up gap | % revenue from repeat | 0-20% / 21-40% / 41-60% / 61%+ / Not sure |

### Sub-paths without a Field 2 follow-up

- Fit mismatch (Acquisition)
- Referral / partner flow is not intentional (Acquisition)
- Review rhythm gap (Retention)

## Rules

- **"Not sure" rule:** If the facilitator picks "Not sure" on Field 2, route to Other (manual) and do NOT auto-generate the plan. (Implemented as a full stop rule.)
- Use the sub-path labels already live in the JotForm. No extra sub-paths beyond the current lean set.

## JotForm QID Assignments

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
