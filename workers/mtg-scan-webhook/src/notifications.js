/**
 * MindtheGaps — Email Notifications (Resend)
 *
 * Sends email notifications to Marc when plans are ready or stopped.
 * Silently skips when RESEND_API_KEY is missing (matches HubSpot pattern).
 *
 * Public API:
 *   notifyPlanReady(env, { email, businessName, planUrl, confidence, scanData, contactInfo, planContent }) → void
 *   notifyDegradedPlan(env, { email, businessName, planUrl, confidence, scanData, contactInfo, planContent }) → void
 *   notifyStopRule(env, { email, businessName, stopReasons, scanData, contactInfo }) → void
 */

// ---------------------------------------------------------------------------
// Shared HTML helpers
// ---------------------------------------------------------------------------

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildScanSummaryHtml(scanData, contactInfo, planContent) {
  const sections = [];

  // Contact info
  sections.push(`
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr style="background:#f8f9fa;"><td colspan="2" style="padding:8px 12px;font-weight:bold;font-size:14px;border-bottom:2px solid #dee2e6;">Contact Info</td></tr>
      ${contactInfo?.firstName ? `<tr><td style="padding:6px 12px;color:#666;width:160px;">Name</td><td style="padding:6px 12px;">${esc(contactInfo.firstName)}</td></tr>` : ''}
      ${contactInfo?.businessName ? `<tr><td style="padding:6px 12px;color:#666;">Business</td><td style="padding:6px 12px;">${esc(contactInfo.businessName)}</td></tr>` : ''}
      ${contactInfo?.industry ? `<tr><td style="padding:6px 12px;color:#666;">Industry</td><td style="padding:6px 12px;">${esc(contactInfo.industry)}</td></tr>` : ''}
      ${contactInfo?.phone ? `<tr><td style="padding:6px 12px;color:#666;">Phone</td><td style="padding:6px 12px;">${esc(contactInfo.phone)}</td></tr>` : ''}
    </table>
  `);

  // Scan diagnosis
  if (scanData) {
    const gapChanged = scanData.quizPrimaryGap && scanData.primaryGap
      && scanData.quizPrimaryGap !== scanData.primaryGap;

    sections.push(`
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr style="background:#f8f9fa;"><td colspan="2" style="padding:8px 12px;font-weight:bold;font-size:14px;border-bottom:2px solid #dee2e6;">Scan Diagnosis</td></tr>
        <tr><td style="padding:6px 12px;color:#666;width:160px;">Primary Gap</td><td style="padding:6px 12px;font-weight:bold;">${esc(scanData.primaryGap)}</td></tr>
        <tr><td style="padding:6px 12px;color:#666;">Sub-path</td><td style="padding:6px 12px;">${esc(scanData.subPath)}</td></tr>
        <tr><td style="padding:6px 12px;color:#666;">One Lever</td><td style="padding:6px 12px;">${esc(scanData.oneLever)}</td></tr>
        ${scanData.field2Answer ? `<tr><td style="padding:6px 12px;color:#666;">${esc(scanData.field2Label || 'Field 2')}</td><td style="padding:6px 12px;">${esc(scanData.field2Answer)}</td></tr>` : ''}
        ${gapChanged ? `<tr><td style="padding:6px 12px;color:#666;">Quiz Gap</td><td style="padding:6px 12px;">${esc(scanData.quizPrimaryGap)} → ${esc(scanData.primaryGap)}</td></tr>` : ''}
        ${gapChanged && scanData.gapChangeReason ? `<tr><td style="padding:6px 12px;color:#666;">Change Reason</td><td style="padding:6px 12px;">${esc(scanData.gapChangeReason)}</td></tr>` : ''}
        ${scanData.contradictionNote ? `<tr><td style="padding:6px 12px;color:#666;">Contradiction</td><td style="padding:6px 12px;">${esc(scanData.contradictionNote)}</td></tr>` : ''}
      </table>
    `);

    // Baseline answers (non-empty, non-"Not sure")
    const baselineEntries = Object.entries(scanData.baselineFields || {})
      .filter(([, v]) => v && v.trim() && v.trim().toLowerCase() !== 'not sure');
    if (baselineEntries.length > 0) {
      const baselineRows = baselineEntries
        .map(([k, v]) => `<tr><td style="padding:4px 12px;color:#666;font-size:13px;">${esc(k)}</td><td style="padding:4px 12px;font-size:13px;">${esc(v)}</td></tr>`)
        .join('');
      sections.push(`
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr style="background:#f8f9fa;"><td colspan="2" style="padding:8px 12px;font-weight:bold;font-size:14px;border-bottom:2px solid #dee2e6;">Baseline Answers</td></tr>
          ${baselineRows}
        </table>
      `);
    }

    // Metrics
    if (scanData.metrics && scanData.metrics.length > 0) {
      sections.push(`
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr style="background:#f8f9fa;"><td style="padding:8px 12px;font-weight:bold;font-size:14px;border-bottom:2px solid #dee2e6;">Selected Metrics</td></tr>
          ${scanData.metrics.map(m => `<tr><td style="padding:4px 12px;font-size:13px;">• ${esc(m)}</td></tr>`).join('')}
        </table>
      `);
    }

    // Constraints
    if (scanData.constraints && scanData.constraints.length > 0) {
      sections.push(`
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr style="background:#f8f9fa;"><td style="padding:8px 12px;font-weight:bold;font-size:14px;border-bottom:2px solid #dee2e6;">Constraints</td></tr>
          ${scanData.constraints.map(c => `<tr><td style="padding:4px 12px;font-size:13px;">• ${esc(c)}</td></tr>`).join('')}
        </table>
      `);
    }
  }

  // Actions from plan content (finalized — includes lookup table defaults)
  if (planContent && planContent.sectionD && planContent.sectionD.actions) {
    const actionRows = planContent.sectionD.actions
      .filter(a => a.description)
      .map((a, i) => `
        <tr>
          <td style="padding:6px 12px;font-size:13px;vertical-align:top;color:#666;width:30px;">${i + 1}.</td>
          <td style="padding:6px 12px;font-size:13px;">${esc(a.description)}</td>
          <td style="padding:6px 12px;font-size:13px;white-space:nowrap;">${esc(a.owner)}</td>
          <td style="padding:6px 12px;font-size:13px;white-space:nowrap;">${esc(a.dueDate)}</td>
        </tr>
      `)
      .join('');

    sections.push(`
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr style="background:#f8f9fa;">
          <td colspan="4" style="padding:8px 12px;font-weight:bold;font-size:14px;border-bottom:2px solid #dee2e6;">Action Plan</td>
        </tr>
        <tr style="background:#f0f0f0;">
          <td style="padding:4px 12px;font-size:12px;font-weight:bold;">#</td>
          <td style="padding:4px 12px;font-size:12px;font-weight:bold;">Action</td>
          <td style="padding:4px 12px;font-size:12px;font-weight:bold;">Owner</td>
          <td style="padding:4px 12px;font-size:12px;font-weight:bold;">Due</td>
        </tr>
        ${actionRows}
      </table>
    `);
  }

  return sections.join('');
}

// ---------------------------------------------------------------------------
// Email builders — pure functions, exposed via _internal for testing
// ---------------------------------------------------------------------------

function buildPlanReadyEmail({ email, businessName, planUrl, confidence, scanData, contactInfo, planContent }) {
  const name = businessName || email;
  const scanSummary = buildScanSummaryHtml(scanData, contactInfo, planContent);

  return {
    subject: `Plan draft ready: ${name}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;color:#333;">
        <div style="background:#2563eb;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:18px;">✅ One-Page Plan Draft Ready</h2>
        </div>
        <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <tr><td style="padding:6px 12px;color:#666;width:160px;">Business</td><td style="padding:6px 12px;font-weight:bold;">${esc(name)}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Email</td><td style="padding:6px 12px;">${esc(email)}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Confidence</td><td style="padding:6px 12px;">${esc(confidence || 'Unknown')}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Plan Link</td><td style="padding:6px 12px;"><a href="${planUrl}" style="color:#2563eb;">${esc(planUrl)}</a></td></tr>
          </table>
          <p style="background:#fef3c7;padding:10px 14px;border-radius:6px;font-size:14px;margin:0 0 20px;">
            ⏰ Please review and deliver within 24 hours.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          ${scanSummary}
        </div>
      </div>
    `,
  };
}

function buildDegradedPlanEmail({ email, businessName, planUrl, confidence, scanData, contactInfo, planContent }) {
  const name = businessName || email;
  const scanSummary = buildScanSummaryHtml(scanData, contactInfo, planContent);

  return {
    subject: `⚠️ Degraded plan draft — human review required: ${name}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;color:#333;">
        <div style="background:#d97706;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:18px;">⚠️ Degraded Plan Draft — Human Review Required</h2>
        </div>
        <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <tr><td style="padding:6px 12px;color:#666;width:160px;">Business</td><td style="padding:6px 12px;font-weight:bold;">${esc(name)}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Email</td><td style="padding:6px 12px;">${esc(email)}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Confidence</td><td style="padding:6px 12px;">${esc(confidence || 'Unknown')}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Plan Link</td><td style="padding:6px 12px;"><a href="${planUrl}" style="color:#2563eb;">${esc(planUrl)}</a></td></tr>
          </table>
          <p style="background:#fee2e2;padding:10px 14px;border-radius:6px;font-size:14px;margin:0 0 16px;color:#991b1b;">
            <strong>Sub-path flagged for manual review.</strong> This plan must be reviewed and customized before delivery.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          ${scanSummary}
        </div>
      </div>
    `,
  };
}

function buildStopRuleEmail({ email, businessName, stopReasons, scanData, contactInfo }) {
  const name = businessName || email;
  const reasonsList = (stopReasons || [])
    .map((r) => `<li style="margin-bottom:4px;">${esc(r)}</li>`)
    .join('\n');
  const scanSummary = buildScanSummaryHtml(scanData, contactInfo, null);

  return {
    subject: `🛑 Manual plan required: ${name}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;color:#333;">
        <div style="background:#dc2626;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:18px;">🛑 Scan Stopped — Manual Plan Required</h2>
        </div>
        <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <tr><td style="padding:6px 12px;color:#666;width:160px;">Business</td><td style="padding:6px 12px;font-weight:bold;">${esc(name)}</td></tr>
            <tr><td style="padding:6px 12px;color:#666;">Email</td><td style="padding:6px 12px;">${esc(email)}</td></tr>
          </table>
          <div style="background:#fee2e2;padding:12px 14px;border-radius:6px;margin-bottom:20px;">
            <strong style="color:#991b1b;">Stop reasons:</strong>
            <ul style="margin:8px 0 0;padding-left:20px;color:#991b1b;">${reasonsList}</ul>
          </div>
          <p style="font-size:14px;color:#666;">This scan did not pass automated stop rules. A manual plan is required.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          ${scanSummary}
        </div>
      </div>
    `,
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
      from: env.FROM_EMAIL || 'MindtheGaps <notifications@mindthegaps.biz>',
      to: [env.MARC_EMAIL || 'marc@mindthegaps.biz'],
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
    buildScanSummaryHtml,
    sendEmail,
    esc,
  },
};
