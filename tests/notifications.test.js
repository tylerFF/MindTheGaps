/**
 * MindtheGaps — storage.js + notifications.js unit tests
 *
 * Tests R2 upload, email builders, and silent-skip behavior.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { uploadPlan } = require('../workers/mtg-scan-webhook/src/storage');
const { notifyPlanReady, notifyStopRule, _internal } = require('../workers/mtg-scan-webhook/src/notifications');
const { buildPlanReadyEmail, buildStopRuleEmail } = _internal;

// ---------------------------------------------------------------------------
// storage.js — uploadPlan
// ---------------------------------------------------------------------------

describe('storage — uploadPlan', () => {
  it('throws when R2_BUCKET is missing', async () => {
    await assert.rejects(
      () => uploadPlan({}, 'test@example.com', Buffer.from('data')),
      /R2_BUCKET binding is required/,
    );
  });

  it('throws when env is null', async () => {
    await assert.rejects(
      () => uploadPlan(null, 'test@example.com', Buffer.from('data')),
      /R2_BUCKET binding is required/,
    );
  });

  it('calls R2_BUCKET.put with correct key format', async () => {
    let capturedKey = null;
    let capturedOptions = null;
    const mockBucket = {
      put: async (key, data, opts) => {
        capturedKey = key;
        capturedOptions = opts;
      },
    };
    const env = { R2_BUCKET: mockBucket };

    const key = await uploadPlan(env, 'test@example.com', Buffer.from('data'));

    assert.ok(key.startsWith('plans/test@example.com/'));
    assert.ok(key.endsWith('.docx'));
    assert.ok(capturedOptions.httpMetadata.contentType.includes('wordprocessingml'));
  });

  it('sanitizes email in key path', async () => {
    const mockBucket = { put: async () => {} };
    const env = { R2_BUCKET: mockBucket };

    const key = await uploadPlan(env, 'user+test@exam ple.com', Buffer.from('data'));

    assert.ok(!key.includes(' '));
    assert.ok(key.includes('user_test@exam_ple.com'));
  });

  it('returns the key string', async () => {
    const mockBucket = { put: async () => {} };
    const env = { R2_BUCKET: mockBucket };

    const key = await uploadPlan(env, 'a@b.com', Buffer.from('data'));

    assert.equal(typeof key, 'string');
    assert.ok(key.startsWith('plans/'));
  });
});

// ---------------------------------------------------------------------------
// notifications.js — buildPlanReadyEmail
// ---------------------------------------------------------------------------

describe('notifications — buildPlanReadyEmail', () => {
  it('returns subject with business name', () => {
    const email = buildPlanReadyEmail({
      email: 'test@example.com',
      businessName: 'Acme Plumbing',
      planUrl: 'https://r2.example.com/plan.docx',
      confidence: 'High',
    });

    assert.ok(email.subject.includes('Acme Plumbing'));
  });

  it('includes all data in html body', () => {
    const email = buildPlanReadyEmail({
      email: 'test@example.com',
      businessName: 'Acme Plumbing',
      planUrl: 'https://r2.example.com/plan.docx',
      confidence: 'Med',
    });

    assert.ok(email.html.includes('test@example.com'));
    assert.ok(email.html.includes('Acme Plumbing'));
    assert.ok(email.html.includes('https://r2.example.com/plan.docx'));
    assert.ok(email.html.includes('Med'));
    assert.ok(email.html.includes('24 hours'));
  });

  it('falls back to email when businessName is missing', () => {
    const email = buildPlanReadyEmail({
      email: 'test@example.com',
      planUrl: 'https://r2.example.com/plan.docx',
    });

    assert.ok(email.subject.includes('test@example.com'));
  });
});

// ---------------------------------------------------------------------------
// notifications.js — buildStopRuleEmail
// ---------------------------------------------------------------------------

describe('notifications — buildStopRuleEmail', () => {
  it('returns subject with business name', () => {
    const email = buildStopRuleEmail({
      email: 'test@example.com',
      businessName: 'Acme Plumbing',
      stopReasons: ['Missing sub-path'],
    });

    assert.ok(email.subject.includes('Acme Plumbing'));
    assert.ok(email.subject.includes('Manual plan required'));
  });

  it('includes all stop reasons as list items', () => {
    const email = buildStopRuleEmail({
      email: 'test@example.com',
      businessName: 'Test Co',
      stopReasons: ['Missing sub-path', 'Gap changed without reason'],
    });

    assert.ok(email.html.includes('Missing sub-path'));
    assert.ok(email.html.includes('Gap changed without reason'));
    assert.ok(email.html.includes('<li>'));
  });

  it('handles empty stop reasons', () => {
    const email = buildStopRuleEmail({
      email: 'test@example.com',
      businessName: 'Test Co',
      stopReasons: [],
    });

    assert.ok(email.html.includes('Manual Plan Required'));
  });
});

// ---------------------------------------------------------------------------
// notifications.js — notifyPlanReady / notifyStopRule (skip behavior)
// ---------------------------------------------------------------------------

describe('notifications — silent skip when no API key', () => {
  it('notifyPlanReady does not throw when RESEND_API_KEY is missing', async () => {
    await notifyPlanReady({}, { email: 'test@example.com', planUrl: 'https://x.com' });
    // No assertion needed — just verifying it doesn't throw
  });

  it('notifyPlanReady does not throw when env is null', async () => {
    await notifyPlanReady(null, { email: 'test@example.com', planUrl: 'https://x.com' });
  });

  it('notifyStopRule does not throw when RESEND_API_KEY is missing', async () => {
    await notifyStopRule({}, { email: 'test@example.com', stopReasons: ['test'] });
  });

  it('notifyStopRule does not throw when env is null', async () => {
    await notifyStopRule(null, { email: 'test@example.com', stopReasons: ['test'] });
  });
});
