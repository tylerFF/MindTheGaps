/**
 * MindtheGaps — Shared Validation Utilities
 *
 * Email validation, field presence checks, and answer sanitization
 * used by webhook handlers before processing.
 *
 * Zero external dependencies.
 */

const { QUESTION_IDS } = require('./constants');

// ---------------------------------------------------------------------------
// Email validation
// ---------------------------------------------------------------------------

/**
 * Basic email format check. Not exhaustive RFC 5322 compliance —
 * catches the common invalid patterns that would break HubSpot upsert.
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;

  // Simple pattern: local@domain.tld
  // - local: non-empty, no spaces, allows dots/hyphens/underscores/plus
  // - domain: at least one dot, no spaces
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(trimmed);
}

/**
 * Normalize an email address (trim + lowercase).
 *
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Field presence checks
// ---------------------------------------------------------------------------

/**
 * Check that all required fields are present and non-empty in an object.
 *
 * @param {object} data - The object to check
 * @param {string[]} requiredFields - Field names that must be present
 * @returns {{ valid: boolean, missing: string[] }}
 */
function checkRequiredFields(data, requiredFields) {
  if (!data || typeof data !== 'object') {
    return { valid: false, missing: [...requiredFields] };
  }

  const missing = requiredFields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

// ---------------------------------------------------------------------------
// Answer extraction / sanitization
// ---------------------------------------------------------------------------

/**
 * Extract quiz answers from a JotForm webhook payload.
 *
 * JotForm sends answers in various formats. This normalizes them into
 * the { questionId: answerText } map that scoreQuiz() expects.
 *
 * @param {object} jotformData - Raw JotForm submission data
 * @param {Record<string, string>} fieldMap - Map of JotForm field name → question ID
 * @returns {Record<string, string>} answers
 */
function extractAnswers(jotformData, fieldMap) {
  if (!jotformData || !fieldMap) return {};

  const answers = {};
  for (const [jotformField, questionId] of Object.entries(fieldMap)) {
    const raw = jotformData[jotformField];
    if (raw !== undefined && raw !== null && raw !== '') {
      answers[questionId] = String(raw).trim();
    }
  }

  return answers;
}

/**
 * Sanitize a string value: trim whitespace, collapse internal runs of
 * whitespace, strip control characters.
 *
 * @param {string} value
 * @returns {string}
 */
function sanitizeString(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(/[\x00-\x1f\x7f]/g, '') // strip control chars
    .trim()
    .replace(/\s+/g, ' '); // collapse whitespace
}

module.exports = {
  isValidEmail,
  normalizeEmail,
  checkRequiredFields,
  extractAnswers,
  sanitizeString,
};
