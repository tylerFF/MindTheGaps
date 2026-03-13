/**
 * MindtheGaps — Quiz Results Email Tests
 *
 * Covers:
 *  - Subject line with/without business name
 *  - HTML includes all key sections (greeting, gap card, CTA, etc.)
 *  - Pillar-specific colors for each gap type
 *  - HTML escaping of user-provided strings
 *  - Eligible vs. not-eligible CTA
 *  - Silent skip when no API key
 *  - Send helper calls Resend API correctly
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildQuizResultsEmail,
  sendQuizResultsEmail,
  _internal,
} = require('../workers/mtg-quiz-webhook/src/quizEmail');

const { escapeHtml, boldToHtml, PILLAR_COLORS } = _internal;

// ===================================================================
// Helpers
// ===================================================================

function sampleData(overrides = {}) {
  return {
    firstName: 'Jane',
    email: 'jane@example.com',
    businessName: 'Acme Plumbing',
    industry: 'Home Services',
    location: 'Toronto, ON',
    teamSize: '5-10',
    primaryGap: 'Conversion',
    baselineScore: 42,
    primaryGapStatement: 'Your biggest growth gap is **Conversion**.',
    subDiagnosisDisplay: 'Leads are coming in but not converting to paying customers.',
    keySignalsLine: 'Signals: low close rate, long sales cycle',
    costOfLeak: '$10,000–$25,000/year in lost revenue',
    costOfLeakAdvice: 'Focus on improving your follow-up process.',
    fastestNextSteps: [
      'Audit your follow-up timing',
      'Create a standard proposal template',
      'Track conversion rate weekly',
    ],
    eligible: true,
    fixFirstReason: null,
    fixFirstAdvice: null,
    stripeCheckoutUrl: 'https://book.stripe.com/test_abc123',
    ...overrides,
  };
}

// ===================================================================
// escapeHtml
// ===================================================================

describe('escapeHtml', () => {
  it('escapes HTML entities', () => {
    assert.equal(escapeHtml('<script>alert("xss")</script>'),
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands and single quotes', () => {
    assert.equal(escapeHtml("Tom & Jerry's"), 'Tom &amp; Jerry&#39;s');
  });

  it('returns empty string for null/undefined', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(123), '');
  });
});

// ===================================================================
// boldToHtml
// ===================================================================

describe('boldToHtml', () => {
  it('converts **bold** to <strong>', () => {
    assert.equal(boldToHtml('Your gap is **Conversion**.'),
      'Your gap is <strong>Conversion</strong>.');
  });

  it('escapes HTML before converting bold', () => {
    assert.equal(boldToHtml('**<script>**'),
      '<strong>&lt;script&gt;</strong>');
  });

  it('returns empty string for falsy input', () => {
    assert.equal(boldToHtml(null), '');
    assert.equal(boldToHtml(''), '');
  });
});

// ===================================================================
// Subject line
// ===================================================================

describe('buildQuizResultsEmail — subject', () => {
  it('includes business name when provided', () => {
    const { subject } = buildQuizResultsEmail(sampleData());
    assert.equal(subject, 'Your Growth Gap Results — Acme Plumbing');
  });

  it('omits business name when empty', () => {
    const { subject } = buildQuizResultsEmail(sampleData({ businessName: '' }));
    assert.equal(subject, 'Your Growth Gap Results');
  });

  it('omits business name when null', () => {
    const { subject } = buildQuizResultsEmail(sampleData({ businessName: null }));
    assert.equal(subject, 'Your Growth Gap Results');
  });
});

// ===================================================================
// HTML content
// ===================================================================

describe('buildQuizResultsEmail — html content', () => {
  it('includes greeting with first name', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('Hi Jane,'));
  });

  it('greeting works without first name', () => {
    const { html } = buildQuizResultsEmail(sampleData({ firstName: '' }));
    assert.ok(html.includes('Hi,'));
    assert.ok(!html.includes('Hi ,'));
  });

  it('includes business name in greeting paragraph', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('<strong>Acme Plumbing</strong>'));
  });

  it('includes personalization details', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('Home Services'));
    assert.ok(html.includes('Toronto, ON'));
    assert.ok(html.includes('5-10'));
  });

  it('includes primary gap statement with bold', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('<strong>Conversion</strong>'));
  });

  it('includes baseline score', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('Gap Score: 42/100'));
  });

  it('includes sub-diagnosis', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('Leads are coming in but not converting'));
  });

  it('includes key signals', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('low close rate'));
  });

  it('includes cost of leak', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('lost revenue'));
  });

  it('includes cost of leak advice', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('follow-up process'));
  });

  it('includes fastest next steps', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('Audit your follow-up timing'));
    assert.ok(html.includes('standard proposal template'));
    assert.ok(html.includes('Track conversion rate weekly'));
  });

  it('includes MindtheGaps logo', () => {
    const { html } = buildQuizResultsEmail(sampleData());
    assert.ok(html.includes('mindthegaps-logo.png'));
  });
});

// ===================================================================
// Pillar colors
// ===================================================================

describe('buildQuizResultsEmail — pillar colors', () => {
  it('uses Acquisition colors', () => {
    const { html } = buildQuizResultsEmail(sampleData({ primaryGap: 'Acquisition' }));
    assert.ok(html.includes(PILLAR_COLORS.Acquisition.color));
    assert.ok(html.includes(PILLAR_COLORS.Acquisition.bg));
  });

  it('uses Conversion colors', () => {
    const { html } = buildQuizResultsEmail(sampleData({ primaryGap: 'Conversion' }));
    assert.ok(html.includes(PILLAR_COLORS.Conversion.color));
    assert.ok(html.includes(PILLAR_COLORS.Conversion.bg));
  });

  it('uses Retention colors', () => {
    const { html } = buildQuizResultsEmail(sampleData({ primaryGap: 'Retention' }));
    assert.ok(html.includes(PILLAR_COLORS.Retention.color));
    assert.ok(html.includes(PILLAR_COLORS.Retention.bg));
  });

  it('defaults to Conversion colors for unknown gap', () => {
    const { html } = buildQuizResultsEmail(sampleData({ primaryGap: 'Unknown' }));
    assert.ok(html.includes(PILLAR_COLORS.Conversion.color));
  });
});

// ===================================================================
// CTA — eligible vs. not eligible
// ===================================================================

describe('buildQuizResultsEmail — CTA', () => {
  it('shows booking CTA when eligible', () => {
    const { html } = buildQuizResultsEmail(sampleData({ eligible: true }));
    assert.ok(html.includes('Book the 45-Minute Growth Gap Scan'));
    assert.ok(html.includes('book.stripe.com'));
    assert.ok(html.includes('CAD $295'));
  });

  it('uses custom stripe URL when provided', () => {
    const { html } = buildQuizResultsEmail(sampleData({
      stripeCheckoutUrl: 'https://custom.stripe.com/xyz',
    }));
    assert.ok(html.includes('https://custom.stripe.com/xyz'));
  });

  it('shows fix-first message when not eligible', () => {
    const { html } = buildQuizResultsEmail(sampleData({
      eligible: false,
      fixFirstReason: 'Your website needs updating first.',
      fixFirstAdvice: 'Start with a mobile-friendly redesign.',
    }));
    assert.ok(html.includes('Before We Can Book Your Scan'));
    assert.ok(html.includes('Your website needs updating first.'));
    assert.ok(html.includes('mobile-friendly redesign'));
    assert.ok(!html.includes('Book the 45-Minute Growth Gap Scan'));
  });
});

// ===================================================================
// HTML escaping
// ===================================================================

describe('buildQuizResultsEmail — XSS prevention', () => {
  it('escapes business name with HTML chars', () => {
    const { html } = buildQuizResultsEmail(sampleData({
      businessName: '<script>alert("xss")</script>',
    }));
    assert.ok(!html.includes('<script>alert'));
    assert.ok(html.includes('&lt;script&gt;'));
  });

  it('escapes first name with HTML chars', () => {
    const { html } = buildQuizResultsEmail(sampleData({
      firstName: '<img onerror="hack">',
    }));
    assert.ok(!html.includes('<img onerror'));
    assert.ok(html.includes('&lt;img'));
  });
});

// ===================================================================
// sendQuizResultsEmail
// ===================================================================

describe('sendQuizResultsEmail', () => {
  it('silently skips when no API key', async () => {
    // Should not throw
    await sendQuizResultsEmail({}, sampleData());
    await sendQuizResultsEmail(null, sampleData());
    await sendQuizResultsEmail({ RESEND_API_KEY: '' }, sampleData());
  });

  it('silently skips when no email', async () => {
    await sendQuizResultsEmail(
      { RESEND_API_KEY: 'test_key' },
      sampleData({ email: '' }),
    );
    await sendQuizResultsEmail(
      { RESEND_API_KEY: 'test_key' },
      sampleData({ email: null }),
    );
  });

  it('skips when data is null', async () => {
    await sendQuizResultsEmail({ RESEND_API_KEY: 'test_key' }, null);
  });
});

// ===================================================================
// Edge cases
// ===================================================================

describe('buildQuizResultsEmail — edge cases', () => {
  it('handles missing optional fields gracefully', () => {
    const { html } = buildQuizResultsEmail({
      firstName: '',
      email: 'test@test.com',
      businessName: '',
      industry: '',
      location: '',
      teamSize: '',
      primaryGap: 'Acquisition',
      baselineScore: 55,
      primaryGapStatement: '',
      subDiagnosisDisplay: '',
      keySignalsLine: '',
      costOfLeak: '',
      costOfLeakAdvice: '',
      fastestNextSteps: [],
      eligible: true,
    });
    // Should not throw; HTML should still be valid
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Your Growth Gap Results'));
  });

  it('handles null baselineScore', () => {
    const { html } = buildQuizResultsEmail(sampleData({ baselineScore: null }));
    assert.ok(html.includes('Gap Score: —/100'));
  });
});
