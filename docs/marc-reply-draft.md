# Reply to Marc - Plan Output Feedback + Go-Live Items

## Note 1 Responses: Plan Output Polish

### 0) "Owner = Marc" in action plans
Confirmed - "Marc" was showing up because we used it as the test client/owner placeholder. The system passes through whatever the facilitator types into the owner field. In production, the facilitator should enter role-based names directly: "Owner/GM," "Ops Lead," "Admin/CSR." No code change needed. If you'd like, we can add helper/placeholder text to the owner fields in the scan worksheet to nudge the facilitator toward role-based entries.

### 1) Baseline + metric label alignment
Done. We audited all 20 baseline labels in the plan output against the live JotForm field labels and fixed 4 mismatches:
- "Lead-to-booked %" is now "Lead to booked %" (removed hyphens, matches JotForm QID 17)
- "Booked-to-show %" is now "Booked to show %" (matches QID 18)
- "Quote-to-close %" is now "Quote to close %" (matches QID 21)
- "Calls answered live" is now "Calls answered live %" (matches the metric checkbox label in QID 61)

All plan output labels now match the live JotForm picklist text 1:1.

### 2) Metric units consistency
The metric "30-day follow-up completion %" maps to a baseline that uses time bands ("3-7 days", "8+ days"), not percentages. The metric name implies a percentage but the baseline is a time band.

Two options:
- Option A: Rename the metric checkbox in JotForm QID 62 from "30-day follow-up completion %" to something like "Follow-up time after service" so the name matches the unit.
- Option B: Leave it as-is and accept the visual mismatch.

We recommend Option A. Let us know your preferred label and we will update both JotForm and the code.

### 3) "One lever" discipline in action ladders
The system passes through exactly what the facilitator enters. Keeping actions tightly scoped to one lever is a facilitator behavior/training item, not a system fix. We suggest noting this in the facilitator guide: Actions 1-2 should be the smallest proof step, and Actions 3-6 should support the same lever/cadence.

### 4) Risk section - less template-y
Done. The risk section now uses the format you suggested:

**Before:** "One risk to momentum: typical first response time is at 3+ days. This often happens when typical first response time is at 3+ days."

**After:** "Risk: Typical first response time is at 3+ days. Slow response lets competitors win the lead first. Mitigation: We'll address this with a small proof step in the first 14 days, not a big rebuild."

Each baseline field has a specific, non-circular risk explanation. 505 tests passing.

---

## Note 2 Responses: QA Alignment + Confirmations A-F

### A) Field 1 dropdown labels - confirmed
We verified via JotForm API on Feb 27. The live Field 1 labels are exactly:

**Conversion (QID 11):**
- Speed-to-lead
- Booking friction
- Show rate
- Quote follow-up / decision drop-off
- Other (manual)

**Acquisition (QID 12):**
- Channel concentration risk
- Demand capture / local visibility
- Lead capture friction
- Other (manual)

(Note: "Fit mismatch" and "Referral / partner flow is not intentional" have been removed per item D below.)

**Retention (QID 13):**
- Rebook/recall gap
- Review rhythm gap
- Referral ask gap
- Post-service follow-up gap
- Other (manual)

### B) H2 is the final A2 ladder (Lead capture friction)
Confirmed. The form is the source of truth. H2 (QID 70) is the final ladder for the A2 (Lead capture friction) sub-path. You can update the guide to match H2 verbatim.

### C) H1 is the final A3 ladder (Demand capture / local visibility)
Confirmed. H1 (QID 69) is the final ladder for the A3 (Demand capture / local visibility) sub-path. You can update the guide to match H1 verbatim.

### D) Orphan paths - implemented Option A (removed from dropdown)
We removed "Fit mismatch" and "Referral / partner flow is not intentional" from the Acquisition sub-path dropdown (QID 12) via JotForm API. They are no longer selectable. The codebase constants have been updated to match.

If you want to bring either back later with proper guide/ladder coverage, we can re-add them.

### E) Resend transfer steps

Here is what we need from you and what we will do:

**Marc does:**
1. Sign up at resend.com
2. In the Resend dashboard, add your sending domain (e.g., mindthegaps.biz)
3. Resend will give you DNS records (SPF, DKIM, DMARC) to add to your domain's DNS settings
4. Once the domain is verified, create an API key in the Resend dashboard
5. Send us three values:
   - The API key
   - Your email address for notifications (e.g., marc@mindthegaps.biz)
   - The "from" address you want on notification emails (e.g., notifications@mindthegaps.biz)

**We do:**
6. Set the three Cloudflare Worker secrets on the scan webhook:
   - RESEND_API_KEY (your API key)
   - MARC_EMAIL (your email)
   - FROM_EMAIL (the from address)
7. Test by submitting a scan worksheet and confirming you receive the notification email

No code changes needed. The system is already wired to use these secrets.

### F) Stripe live-mode steps

Here is the full checklist:

**Marc does:**
1. Log into Stripe Dashboard and toggle from "Test mode" to "Live mode"
2. Create a new live payment link for $295 CAD (Products > Create product > Create payment link)
3. In the payment link settings, set the success URL to: https://mtg-pages-3yo.pages.dev/booking/
4. Go to Developers > Webhooks and create a new endpoint:
   - URL: https://mtg-stripe-webhook.mindthegaps-biz-account.workers.dev
   - Events: checkout.session.completed (only this one)
5. Copy the webhook signing secret (starts with "whsec_")
6. Send us two values:
   - The new live payment link URL
   - The webhook signing secret

**We do:**
7. Update STRIPE_WEBHOOK_SECRET on the Cloudflare Worker with the new signing secret
8. Update the results page (pages/results/index.html) with the new live payment link URL
9. Deploy the updated results page

**Final verification (together):**
10. Make one real $295 CAD test payment through the full flow
11. Verify: payment completes, HubSpot shows "Paid," booking page loads after redirect
12. Refund the test payment immediately in the Stripe dashboard
13. Confirm everything works, then the system is live

---

## Summary of what we did

| Item | Status |
|------|--------|
| Owner field | No code change needed. Facilitator training item. |
| Baseline labels aligned to JotForm | Done. 4 labels corrected. |
| Metric unit consistency | Flagged. Waiting on your decision (rename checkbox or accept mismatch). |
| Action ladder discipline | No code change needed. Facilitator guide item. |
| Risk section rewritten | Done. Now uses Risk/Mitigation format with specific context. |
| Orphan sub-paths removed | Done. "Fit mismatch" and "Referral/partner flow" removed from dropdown. |
| Resend steps documented | See section E above. |
| Stripe steps documented | See section F above. |
| All tests passing | 505 tests, 0 failures. |
