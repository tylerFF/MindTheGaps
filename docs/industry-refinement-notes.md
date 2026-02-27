# Industry List — Refinement Notes

> Last updated: Feb 27, 2026
> Decision: **No changes now.** Keep current list stable. Record proposed edits for later review.

---

## Marc's Direction (Feb 27, 2026)

- No rework to the current market map / category structure
- Proceed with approved ticket items only
- Keep a record of any suggested substitutions or naming changes for later review
- Main concern: avoiding unnecessary risk with JotForm/HubSpot matching and anything tied to that
- Display-only tweaks that don't affect functionality, values, mapping, logic, or sync can be flagged but not applied

---

## Current Industry List (Live)

Used in: Quiz form (JotForm 260466844433158) + Scan Worksheet (JotForm 260435948553162) + HubSpot `mtg_industry` property

1. Home Services
2. Health & Wellness
3. Professional Services
4. Financial Services
5. Automotive
6. Real Estate
7. Legal
8. Dental / Medical
9. Trades / Contracting
10. Beauty / Personal Care
11. Insurance
12. Fitness / Recreation
13. Other

---

## Proposed Refinements (For Later Review)

These are not approved for implementation. Documenting here so they don't get lost.

| Current Category | Notes |
|-----------------|-------|
| Home Services | Keep |
| Health & Wellness | Review later for overlap with Fitness / Recreation and regulated care categories |
| Professional Services | Keep for now, but may later split into clearer business-service groupings |
| Financial Services | Review later due to regulation/compliance sensitivity |
| Automotive | Keep |
| Real Estate | Review later due to regulation/compliance sensitivity |
| Legal | Review later due to regulation/compliance sensitivity |
| Dental / Medical | Review later due to regulation/compliance sensitivity |
| Trades / Contracting | May overlap with Home Services; review later |
| Beauty / Personal Care | Keep |
| Insurance | Review later due to regulation/compliance sensitivity |
| Fitness / Recreation | Keep for now; review later for overlap with Health & Wellness |
| Other | Keep |

---

## Possible Future Groupings

If and when the industry list is revisited, Marc may want to move toward broader groupings:

- Home + Property Services
- IT + Technical Services
- Business Services
- Marketing + Growth Services
- Personal + Consumer Services
- Industrial + Field Services

At that stage, decisions would also be needed on whether to remove, deprioritize, or handle some regulated categories differently.

---

## What Would Need to Change (If/When Approved)

Any industry list change touches multiple systems that must stay in sync:

1. **JotForm Quiz** — dropdown options on the industry question
2. **JotForm Scan Worksheet** — dropdown options on `scanIndustry` field
3. **HubSpot** — `mtg_industry` property enumeration values
4. **Results content** (if industry-specific copy exists)
5. **Any reporting/filtering** built on industry values

This is why Marc wants to avoid changes here until there's a clear reason. The mapping between JotForm dropdowns and HubSpot property values must match exactly.
