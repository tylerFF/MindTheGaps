/**
 * MindtheGaps — Quiz Results Email
 *
 * Sends a personalized email to the prospect after quiz completion.
 * The email mirrors the results page content so they can book the
 * scan later even if they close the browser.
 *
 * Public API:
 *   sendQuizResultsEmail(env, data)  → Promise<void>
 *   buildQuizResultsEmail(data)      → { subject, html }
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOGO_URL = 'https://mtg-pages-3yo.pages.dev/assets/mindthegaps-logo.png';

const PILLAR_COLORS = {
  Acquisition: { color: '#2e86ab', bg: '#e3f2fd' },
  Conversion:  { color: '#a23b72', bg: '#fce4ec' },
  Retention:   { color: '#f18f01', bg: '#fff3e0' },
};

const DEFAULT_STRIPE_URL = 'https://book.stripe.com/test_bJebJ28Jl30W3yL8Q81sQ01';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape HTML entities to prevent XSS in email clients.
 */
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert markdown bold (**text**) to <strong> tags.
 */
function boldToHtml(str) {
  if (!str) return '';
  return escapeHtml(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// ---------------------------------------------------------------------------
// Email builder
// ---------------------------------------------------------------------------

/**
 * Build the quiz results email content.
 *
 * @param {object} data
 * @param {string} data.firstName
 * @param {string} data.email
 * @param {string} data.businessName
 * @param {string} data.industry
 * @param {string} data.location
 * @param {string} data.teamSize
 * @param {string} data.primaryGap
 * @param {number} data.baselineScore
 * @param {string} data.primaryGapStatement
 * @param {string} data.subDiagnosisDisplay
 * @param {string} data.keySignalsLine
 * @param {string} data.costOfLeak
 * @param {string} data.costOfLeakAdvice
 * @param {string[]} data.fastestNextSteps
 * @param {boolean} data.eligible
 * @param {string} [data.fixFirstReason]
 * @param {string} [data.fixFirstAdvice]
 * @param {string} [data.stripeCheckoutUrl]
 * @returns {{ subject: string, html: string }}
 */
function buildQuizResultsEmail(data) {
  const name = escapeHtml(data.firstName || '');
  const business = escapeHtml(data.businessName || '');
  const industry = escapeHtml(data.industry || '');
  const location = escapeHtml(data.location || '');
  const teamSize = escapeHtml(data.teamSize || '');
  const gap = data.primaryGap || 'Conversion';
  const score = data.baselineScore != null ? data.baselineScore : '—';
  const pillar = PILLAR_COLORS[gap] || PILLAR_COLORS.Conversion;
  const stripeUrl = data.stripeCheckoutUrl || DEFAULT_STRIPE_URL;

  const subject = business
    ? `Your Growth Gap Results — ${data.businessName}`
    : 'Your Growth Gap Results';

  // Personalization details (only show non-empty ones)
  const details = [];
  if (business) details.push(`<strong>Business:</strong> ${business}`);
  if (industry) details.push(`<strong>Industry:</strong> ${industry}`);
  if (location) details.push(`<strong>Location:</strong> ${location}`);
  if (teamSize) details.push(`<strong>Team size:</strong> ${teamSize}`);
  const detailsHtml = details.length > 0
    ? `<p style="font-size:14px;color:#555;margin:12px 0 0 0;word-wrap:break-word;">${details.join(' · ')}</p>`
    : '';

  // Sub-diagnosis section
  const subDiagHtml = data.subDiagnosisDisplay
    ? `<div style="padding:12px 16px;background:#f8f9fa;border-left:3px solid ${pillar.color};border-radius:0 6px 6px 0;margin:16px 0 0 0;font-size:15px;color:#333;">${escapeHtml(data.subDiagnosisDisplay)}</div>`
    : '';

  // Key signals
  const signalsHtml = data.keySignalsLine
    ? `<p style="font-size:14px;font-style:italic;color:#555;margin:16px 0 0 0;">${escapeHtml(data.keySignalsLine)}</p>`
    : '';

  // Next steps list
  const stepsHtml = (data.fastestNextSteps || [])
    .map(s => `<li style="padding:6px 0;font-size:15px;color:#333;">${escapeHtml(s)}</li>`)
    .join('');

  // CTA section
  let ctaHtml;
  if (data.eligible) {
    ctaHtml = `
      <td style="background:#fff;border-radius:12px;padding:28px 24px;text-align:center;">
        <p style="font-size:17px;font-weight:600;color:#16213e;margin:0 0 8px 0;">Ready for Your Personalized Plan?</p>
        <p style="font-size:14px;color:#555;margin:0 0 20px 0;">Get a 45-minute facilitator-led scan to build your custom One-Page Growth Plan.</p>
        <a href="${escapeHtml(stripeUrl)}" style="display:inline-block;padding:14px 32px;border-radius:8px;background:${pillar.color};color:#fff;text-decoration:none;font-weight:600;font-size:16px;">Book the 45-Minute Growth Gap Scan</a>
        <p style="font-size:13px;color:#6c757d;margin:10px 0 0 0;">CAD $295 &mdash; one-time</p>
      </td>`;
  } else {
    const fixReason = escapeHtml(data.fixFirstReason || '');
    const fixAdvice = escapeHtml(data.fixFirstAdvice || '');
    ctaHtml = `
      <td style="background:#fff8e1;border:1px solid #ffe082;border-radius:12px;padding:24px;">
        <p style="font-size:15px;font-weight:600;color:#e65100;margin:0 0 8px 0;">Before We Can Book Your Scan</p>
        ${fixReason ? `<p style="font-size:14px;color:#555;margin:0 0 8px 0;">${fixReason}</p>` : ''}
        ${fixAdvice ? `<p style="font-size:14px;color:#555;margin:0;">${fixAdvice}</p>` : ''}
      </td>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#1a1a2e;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- Logo + Header -->
  <tr><td style="text-align:center;padding:0 0 24px 0;">
    <img src="${LOGO_URL}" alt="MindtheGaps" width="180" style="display:block;margin:0 auto 16px;width:180px;height:auto;">
    <h1 style="font-size:22px;font-weight:700;color:#16213e;margin:0 0 4px 0;">Your Growth Gap Results</h1>
    <p style="font-size:14px;color:#6c757d;margin:0;">MindtheGaps Business Diagnostic</p>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;">
    <p style="font-size:16px;color:#1a1a2e;margin:0 0 8px 0;">Hi${name ? ' ' + name : ''},</p>
    <p style="font-size:15px;color:#444;margin:0;">Here are the results from your MindtheGaps Growth Gap Quiz${business ? ' for <strong>' + business + '</strong>' : ''}.</p>
    ${detailsHtml}
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- Primary Gap Card -->
  <tr><td style="background:#fff;border-radius:12px;padding:24px;">
    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#6c757d;margin:0 0 8px 0;">Primary Growth Gap</p>
    <p style="font-size:20px;font-weight:600;line-height:1.4;color:#1a1a2e;margin:0 0 12px 0;">${boldToHtml(data.primaryGapStatement || '')}</p>
    <span style="display:inline-block;padding:6px 14px;border-radius:20px;background:${pillar.bg};color:${pillar.color};font-size:14px;font-weight:600;">Gap Score: ${score}/100</span>
    ${subDiagHtml}
    ${signalsHtml}
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- Cost of Leak -->
  <tr><td style="background:#fff;border-radius:12px;padding:24px;">
    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#6c757d;margin:0 0 8px 0;">What This Costs You</p>
    <p style="font-size:16px;font-weight:600;color:#c0392b;margin:0 0 8px 0;">${escapeHtml(data.costOfLeak || '')}</p>
    <p style="font-size:14px;color:#555;margin:0;">${escapeHtml(data.costOfLeakAdvice || '')}</p>
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- Fastest Next Steps -->
  <tr><td style="background:#fff;border-radius:12px;padding:24px;">
    <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#6c757d;margin:0 0 8px 0;">Fastest Next Steps</p>
    <ul style="list-style:none;padding:0;margin:0;">${stepsHtml}</ul>
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- CTA -->
  <tr>${ctaHtml}</tr>

  <!-- Footer -->
  <tr><td style="text-align:center;padding:24px 0 0 0;">
    <p style="font-size:13px;color:#6c757d;margin:0 0 4px 0;">Questions? Reply to this email.</p>
    <p style="font-size:13px;color:#999;margin:0;">MindtheGaps</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Send helper
// ---------------------------------------------------------------------------

/**
 * Send the quiz results email to the prospect.
 * Silently skips if RESEND_API_KEY is not configured.
 */
async function sendQuizResultsEmail(env, data) {
  if (!env || !env.RESEND_API_KEY) {
    return; // Skip silently — same pattern as scan notifications
  }

  if (!data || !data.email) {
    console.error('Quiz results email skipped: no recipient email');
    return;
  }

  const { subject, html } = buildQuizResultsEmail(data);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'MindtheGaps <notifications@mindthegaps.biz>',
      to: [data.email],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API returned ${response.status}: ${errorText}`);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  sendQuizResultsEmail,
  buildQuizResultsEmail,
  _internal: {
    escapeHtml,
    boldToHtml,
    PILLAR_COLORS,
  },
};
