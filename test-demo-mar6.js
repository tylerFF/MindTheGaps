// Paste this into your browser console on any page to submit 3 test contacts
// under cohort DEMO-MAR6 with all fields populated.
//
// Worker endpoint:
const WORKER = 'https://mtg-quiz-webhook.mindthegaps-biz-account.workers.dev';

const contacts = [
  {
    firstName: 'Sarah',
    email: 'sarah.demo.mar6@test.com',
    businessName: "Sarah's Landscaping",
    industry: 'Home Services',
    location: 'Vancouver, BC',
    teamSize: '2-5',
    cohort_id: 'DEMO-MAR6',
    variant_id: 'A',
    source_channel: 'Email',
    answers: {
      V1: 'Getting new customers',
      A1: 'Rarely',   A2: 'No',       A3: 'Unsure',
      C1: 'Rarely',   C2: 'No',       C3: 'Too high',
      R1: 'Rarely',   R2: 'Rarely',   R3: 'No program',
      B1: 'Under $250K', B2: '2-5', B3: 'None', B4: 'Just starting'
    }
  },
  {
    firstName: 'Marcus',
    email: 'marcus.demo.mar6@test.com',
    businessName: 'Marcus Plumbing Pro',
    industry: 'Trades / Contractors',
    location: 'Toronto, ON',
    teamSize: '6-15',
    cohort_id: 'DEMO-MAR6',
    variant_id: 'A',
    source_channel: 'Referral',
    answers: {
      V1: 'Keeping customers coming back',
      A1: 'Sometimes', A2: 'Basic',    A3: 'Somewhat',
      C1: 'Rarely',    C2: 'No',       C3: 'Slow follow-up',
      R1: 'Rarely',    R2: 'Rarely',   R3: 'No program',
      B1: '$250K-$500K', B2: '6-15', B3: '1-2', B4: '1-2 years'
    }
  },
  {
    firstName: 'Priya',
    email: 'priya.demo.mar6@test.com',
    businessName: "Priya's Cleaning Co",
    industry: 'Cleaning Services',
    location: 'Calgary, AB',
    teamSize: '2-5',
    cohort_id: 'DEMO-MAR6',
    variant_id: 'B',
    source_channel: 'LinkedIn',
    answers: {
      V1: 'Turning leads into paying customers',
      A1: 'Sometimes', A2: 'Basic',    A3: 'Somewhat',
      C1: 'Rarely',    C2: 'No',       C3: 'No clear offer',
      R1: 'Sometimes', R2: 'Sometimes', R3: 'Informal',
      B1: 'Under $250K', B2: '2-5', B3: 'None', B4: '1-2 years'
    }
  }
];

(async () => {
  for (const c of contacts) {
    try {
      const resp = await fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c)
      });
      const text = await resp.text();
      console.log(`${c.firstName}: ${resp.status} — ${text.slice(0, 200)}`);
    } catch (e) {
      console.error(`${c.firstName} FAILED:`, e);
    }
  }
  console.log('Done! Now check: https://mtg-report.mindthegaps-biz-account.workers.dev/?from=2026-03-06&to=2026-03-06&format=html');
})();
