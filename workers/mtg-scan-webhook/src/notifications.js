/**
 * MindtheGaps — Email Notifications (Resend)
 *
 * Sends email notifications to Marc when plans are ready or stopped.
 * Silently skips when RESEND_API_KEY is missing (matches HubSpot pattern).
 *
 * Public API:
 *   notifyPlanReady(env, { email, businessName, planUrl, confidence }) → void
 *   notifyDegradedPlan(env, { email, businessName, planUrl, confidence }) → void
 *   notifyStopRule(env, { email, businessName, stopReasons }) → void
 */

// ---------------------------------------------------------------------------
// Email builders — pure functions, exposed via _internal for testing
// ---------------------------------------------------------------------------

function buildPlanReadyEmail({ email, businessName, planUrl, confidence }) {
  const name = businessName || email;
  return {
    subject: `Plan draft ready: ${name}`,
    html: [
      `<h2>One-Page Plan Draft Ready</h2>`,
      `<p><strong>Business:</strong> ${name}</p>`,
      `<p><strong>Contact:</strong> ${email}</p>`,
      `<p><strong>Confidence:</strong> ${confidence || 'Unknown'}</p>`,
      `<p><strong>Plan link:</strong> <a href="${planUrl}">${planUrl}</a></p>`,
      `<p>Please review and deliver within 24 hours.</p>`,
    ].join('\n'),
  };
}

function buildDegradedPlanEmail({ email, businessName, planUrl, confidence }) {
  const name = businessName || email;
  return {
    subject: `Degraded plan draft — human review required: ${name}`,
    html: [
      `<h2>Degraded Plan Draft — Human Review Required</h2>`,
      `<p><strong>Business:</strong> ${name}</p>`,
      `<p><strong>Contact:</strong> ${email}</p>`,
      `<p><strong>Confidence:</strong> ${confidence || 'Unknown'}</p>`,
      `<p><strong>Plan link:</strong> <a href="${planUrl}">${planUrl}</a></p>`,
      `<p><strong style="color: #cc0000;">Draft plan generated but sub-path was Other (manual). Human review required before sending to client.</strong></p>`,
      `<p>This plan was auto-generated in degraded mode because the facilitator selected "Other (manual)" as the sub-path. The plan content uses generic phrasing and must be reviewed and customized before delivery.</p>`,
    ].join('\n'),
  };
}

function buildStopRuleEmail({ email, businessName, stopReasons }) {
  const name = businessName || email;
  const reasonsList = (stopReasons || [])
    .map((r) => `<li>${r}</li>`)
    .join('\n');

  return {
    subject: `Manual plan required: ${name}`,
    html: [
      `<h2>Scan Stopped — Manual Plan Required</h2>`,
      `<p><strong>Business:</strong> ${name}</p>`,
      `<p><strong>Contact:</strong> ${email}</p>`,
      `<p><strong>Stop reasons:</strong></p>`,
      `<ul>${reasonsList}</ul>`,
      `<p>This scan did not pass automated stop rules. A manual plan is required.</p>`,
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Send helper — calls Resend API
// ---------------------------------------------------------------------------

async function sendEmail(env, { subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'MindtheGaps <noreply@mindthegaps.com>',
      to: [env.MARC_EMAIL || 'marc@mindthegaps.com'],
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
// Public API
// ---------------------------------------------------------------------------

async function notifyPlanReady(env, data) {
  if (!env || !env.RESEND_API_KEY) {
    return; // Skip silently when no API key
  }
  const emailContent = buildPlanReadyEmail(data);
  await sendEmail(env, emailContent);
}

async function notifyDegradedPlan(env, data) {
  if (!env || !env.RESEND_API_KEY) {
    return; // Skip silently when no API key
  }
  const emailContent = buildDegradedPlanEmail(data);
  await sendEmail(env, emailContent);
}

async function notifyStopRule(env, data) {
  if (!env || !env.RESEND_API_KEY) {
    return; // Skip silently when no API key
  }
  const emailContent = buildStopRuleEmail(data);
  await sendEmail(env, emailContent);
}

module.exports = {
  notifyPlanReady,
  notifyDegradedPlan,
  notifyStopRule,
  _internal: {
    buildPlanReadyEmail,
    buildDegradedPlanEmail,
    buildStopRuleEmail,
    sendEmail,
  },
};
