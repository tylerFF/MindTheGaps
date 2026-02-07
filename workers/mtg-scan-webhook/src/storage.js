/**
 * MindtheGaps — R2 Storage
 *
 * Uploads DOCX plan drafts to Cloudflare R2.
 * Key format: plans/{email}/{timestamp}.docx
 *
 * Public API:
 *   uploadPlan(env, email, buffer) → string (object key)
 */

/**
 * Upload a DOCX plan buffer to R2.
 *
 * @param {object} env — Worker env bindings (needs R2_BUCKET)
 * @param {string} email — contact email (used in key path)
 * @param {Buffer} buffer — DOCX file buffer
 * @returns {Promise<string>} the R2 object key
 */
async function uploadPlan(env, email, buffer) {
  if (!env || !env.R2_BUCKET) {
    throw new Error('R2_BUCKET binding is required for plan upload');
  }

  const timestamp = Date.now();
  const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const key = `plans/${safeEmail}/${timestamp}.docx`;

  await env.R2_BUCKET.put(key, buffer, {
    httpMetadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  });

  return key;
}

module.exports = { uploadPlan };
