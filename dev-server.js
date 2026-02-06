/**
 * MindtheGaps — Local Development Server
 *
 * Serves a quiz form + results page locally for testing the full pipeline
 * without Cloudflare or any external services.
 *
 * Usage:  node dev-server.js
 *         npm run dev
 *
 * Then open http://localhost:3000 in your browser.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { scoreQuiz } = require('./workers/mtg-quiz-webhook/src/scoring');
const { generateResults } = require('./workers/mtg-quiz-webhook/src/results');
const { checkEligibility } = require('./workers/mtg-quiz-webhook/src/eligibility');

const PORT = 3000;
const RESULTS_HTML = fs.readFileSync(
  path.join(__dirname, 'pages', 'results', 'index.html'),
  'utf-8',
);

// ---------------------------------------------------------------------------
// Quiz form HTML — matches the exact questions + options from the spec
// ---------------------------------------------------------------------------

const QUIZ_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MindtheGaps Growth Gap Quiz</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6; color: #1a1a2e; background: #f8f9fa; min-height: 100vh;
    }
    .container { max-width: 640px; margin: 0 auto; padding: 2rem 1.25rem; }
    h1 { font-size: 1.5rem; text-align: center; margin-bottom: 0.25rem; color: #16213e; }
    .subtitle { text-align: center; color: #6c757d; font-size: 0.9rem; margin-bottom: 2rem; }
    .dev-badge {
      display: block; text-align: center; margin-bottom: 1.5rem;
      padding: 0.4rem 0.8rem; background: #fff3cd; border: 1px solid #ffc107;
      border-radius: 6px; font-size: 0.8rem; color: #856404;
    }
    .question {
      background: #fff; border-radius: 10px; padding: 1.25rem 1.5rem;
      margin-bottom: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .question label {
      display: block; font-weight: 600; font-size: 0.95rem; margin-bottom: 0.5rem;
    }
    .question .qid {
      display: inline-block; background: #e8edf3; color: #0f3460; font-size: 0.7rem;
      padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 700; margin-right: 0.4rem;
    }
    select {
      width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #ced4da;
      border-radius: 6px; font-size: 0.9rem; background: #fff; color: #333;
    }
    select:focus { outline: none; border-color: #0f3460; box-shadow: 0 0 0 2px rgba(15,52,96,0.15); }
    .section-label {
      font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; color: #6c757d; margin: 1.5rem 0 0.75rem;
    }
    button {
      display: block; width: 100%; padding: 0.85rem; margin-top: 1.5rem;
      background: #0f3460; color: #fff; border: none; border-radius: 8px;
      font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <h1>MindtheGaps Growth Gap Quiz</h1>
    <p class="subtitle">Answer 13 quick questions to find your primary growth gap.</p>
    <span class="dev-badge">LOCAL DEV MODE — This form runs the production scoring pipeline locally</span>

    <form method="POST" action="/submit">

      <div class="section-label">Your Focus</div>

      <div class="question">
        <label><span class="qid">V1</span> What's your biggest growth focus right now?</label>
        <select name="V1">
          <option value="">— Select —</option>
          <option value="Getting more leads (Acquisition)">Getting more leads (Acquisition)</option>
          <option value="Turning leads into booked work (Conversion)">Turning leads into booked work (Conversion)</option>
          <option value="Getting repeats/referrals (Retention)">Getting repeats/referrals (Retention)</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="section-label">Volume &amp; Channels</div>

      <div class="question">
        <label><span class="qid">V2</span> Roughly how many qualified leads do you get per month?</label>
        <select name="V2">
          <option value="">— Select —</option>
          <option value="0-9">0-9</option>
          <option value="10-24">10-24</option>
          <option value="25-49">25-49</option>
          <option value="50+">50+</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="question">
        <label><span class="qid">V3</span> How long does it typically take to respond to a new lead?</label>
        <select name="V3">
          <option value="">— Select —</option>
          <option value="Within 15 minutes">Within 15 minutes</option>
          <option value="Within 1 hour">Within 1 hour</option>
          <option value="Same day">Same day</option>
          <option value="1-2 days">1-2 days</option>
          <option value="3+ days">3+ days</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="question">
        <label><span class="qid">V4</span> What % of people who book with you actually show up?</label>
        <select name="V4">
          <option value="">— Select —</option>
          <option value="Under 40%">Under 40%</option>
          <option value="40-59%">40-59%</option>
          <option value="60-79%">60-79%</option>
          <option value="80%+">80%+</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="question">
        <label><span class="qid">V5</span> Where do your leads come from?</label>
        <select name="V5">
          <option value="">— Select —</option>
          <option value="Most leads come from one source">Most leads come from one source</option>
          <option value="Two sources">Two sources</option>
          <option value="Three or more sources">Three or more sources</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="section-label">Lead Quality</div>

      <div class="question">
        <label><span class="qid">A1</span> Of the leads you get, roughly how many fit your ideal customer profile?</label>
        <select name="A1">
          <option value="">— Select —</option>
          <option value="0-5">0-5</option>
          <option value="6-10">6-10</option>
          <option value="11-15">11-15</option>
          <option value="16-20">16-20</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="section-label">Conversion Process</div>

      <div class="question">
        <label><span class="qid">C1</span> Who owns the first response to a new lead?</label>
        <select name="C1">
          <option value="">— Select —</option>
          <option value="No consistent owner">No consistent owner</option>
          <option value="Varies">Varies</option>
          <option value="Coordinator/Front desk">Coordinator/Front desk</option>
          <option value="Sales">Sales</option>
          <option value="Specialist">Specialist</option>
          <option value="Owner">Owner</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="question">
        <label><span class="qid">C2</span> How long from first contact to getting on a first appointment?</label>
        <select name="C2">
          <option value="">— Select —</option>
          <option value="Same day">Same day</option>
          <option value="1-2 days">1-2 days</option>
          <option value="3-7 days">3-7 days</option>
          <option value="8-14 days">8-14 days</option>
          <option value="15+ days">15+ days</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="question">
        <label><span class="qid">C3</span> What's the biggest reason leads don't book?</label>
        <select name="C3">
          <option value="">— Select —</option>
          <option value="Can't reach them / slow follow-up">Can't reach them / slow follow-up</option>
          <option value="They ghost after the quote">They ghost after the quote</option>
          <option value="Price objections">Price objections</option>
          <option value="Not the right fit">Not the right fit</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="question">
        <label><span class="qid">C4</span> How long from quote to close (or decision)?</label>
        <select name="C4">
          <option value="">— Select —</option>
          <option value="Same day">Same day</option>
          <option value="2-7 days">2-7 days</option>
          <option value="8-14 days">8-14 days</option>
          <option value="15-30 days">15-30 days</option>
          <option value="31-90 days">31-90 days</option>
          <option value="90+ days">90+ days</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="section-label">Retention</div>

      <div class="question">
        <label><span class="qid">R1</span> How often do you touch base with past customers?</label>
        <select name="R1">
          <option value="">— Select —</option>
          <option value="Rarely/Never">Rarely/Never</option>
          <option value="Yearly">Yearly</option>
          <option value="Quarterly">Quarterly</option>
          <option value="Twice per year">Twice per year</option>
          <option value="Monthly">Monthly</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="question">
        <label><span class="qid">R2</span> How's your client base trending?</label>
        <select name="R2">
          <option value="">— Select —</option>
          <option value="Shrunk">Shrunk</option>
          <option value="Flat">Flat</option>
          <option value="Grown">Grown</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div class="question">
        <label><span class="qid">R3</span> Where does your revenue come from?</label>
        <select name="R3">
          <option value="">— Select —</option>
          <option value="Most revenue comes from new customers">Most revenue comes from new customers</option>
          <option value="Roughly split between new and existing customers">Roughly split between new and existing customers</option>
          <option value="Most revenue comes from existing customers">Most revenue comes from existing customers</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <button type="submit">See My Results</button>
    </form>
  </div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Serve quiz form
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(QUIZ_HTML);
    return;
  }

  // Serve results page
  if (url.pathname === '/results/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(RESULTS_HTML);
    return;
  }

  // Process quiz submission
  if (url.pathname === '/submit' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        // Parse form-encoded body
        const params = new URLSearchParams(body);
        const answers = {};
        for (const [key, value] of params.entries()) {
          if (value) answers[key] = value;
        }

        // Run the production pipeline
        const scoringResult = scoreQuiz(answers);
        const resultsContent = generateResults(scoringResult, answers);
        const eligibilityResult = checkEligibility(scoringResult, answers);

        // Build results data (same shape as webhook response)
        const resultsData = {
          scoring: {
            primaryGap: scoringResult.primaryGap,
            baselineScore: scoringResult.baselineScore,
            pillarTotals: scoringResult.pillarTotals,
          },
          results: {
            primaryGapStatement: resultsContent.primaryGapStatement,
            subDiagnosis: resultsContent.subDiagnosis,
            subDiagnosisDisplay: resultsContent.subDiagnosisDisplay,
            keySignalsLine: resultsContent.keySignalsLine,
            costOfLeak: resultsContent.costOfLeak,
            costOfLeakAdvice: resultsContent.costOfLeakAdvice,
            fastestNextSteps: resultsContent.fastestNextSteps,
          },
          eligibility: {
            eligible: eligibilityResult.eligible,
            fixFirstReason: eligibilityResult.fixFirstReason,
            fixFirstAdvice: eligibilityResult.fixFirstAdvice,
          },
        };

        // Encode and redirect to results page
        const encoded = Buffer.from(JSON.stringify(resultsData)).toString('base64');
        res.writeHead(302, { Location: `/results/#${encoded}` });
        res.end();

        // Log to console for debugging
        console.log(`\n--- Quiz Submitted ---`);
        console.log(`Primary Gap: ${scoringResult.primaryGap}`);
        console.log(`Score: ${scoringResult.baselineScore}/100`);
        console.log(`Sub-diagnosis: ${resultsContent.subDiagnosis || '(none)'}`);
        console.log(`Eligible: ${eligibilityResult.eligible}`);
        if (!eligibilityResult.eligible) {
          console.log(`Fix-first: ${eligibilityResult.fixFirstReason}`);
        }
        console.log(`Pillar totals: Acq=${scoringResult.pillarTotals.Acquisition}, Conv=${scoringResult.pillarTotals.Conversion}, Ret=${scoringResult.pillarTotals.Retention}`);
      } catch (err) {
        console.error('Processing error:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error processing quiz: ' + err.message);
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`\n  MindtheGaps Dev Server running at http://localhost:${PORT}`);
  console.log(`  Quiz form:    http://localhost:${PORT}/`);
  console.log(`  Results page: http://localhost:${PORT}/results/\n`);
});
