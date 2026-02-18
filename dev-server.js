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
const QUIZ_HTML = fs.readFileSync(
  path.join(__dirname, 'pages', 'quiz', 'index.html'),
  'utf-8',
);

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
        // Parse body — accept JSON or form-encoded
        const contentType = req.headers['content-type'] || '';
        let fields = {};
        if (contentType.includes('json')) {
          fields = JSON.parse(body);
        } else {
          const params = new URLSearchParams(body);
          for (const [key, value] of params.entries()) {
            fields[key] = value;
          }
        }

        const answers = {};
        const profile = {};
        const PROFILE_FIELDS = ['firstName', 'email', 'businessName', 'industry', 'location', 'teamSize', 'website', 'phone'];
        for (const [key, value] of Object.entries(fields)) {
          if (!value) continue;
          if (PROFILE_FIELDS.includes(key)) {
            profile[key] = value;
          } else {
            answers[key] = value;
          }
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

        // Return JSON response (same format as production worker)
        const encoded = Buffer.from(JSON.stringify(resultsData)).toString('base64');
        const responseBody = {
          success: true,
          email: profile.email || '',
          resultsUrl: `/results/#${encoded}`,
          ...resultsData,
          _meta: {
            hubspotStatus: 'skipped',
            processedAt: new Date().toISOString(),
          },
        };

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(responseBody));

        // Log to console for debugging
        console.log(`\n--- Quiz Submitted ---`);
        if (profile.firstName) console.log(`Contact: ${profile.firstName} (${profile.email || 'no email'}) — ${profile.businessName || ''}`);
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
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error processing quiz: ' + err.message }));
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
