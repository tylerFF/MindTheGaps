/**
 * MindtheGaps — Stripe Webhook unit tests
 *
 * Tests payment data extraction, HubSpot property building, and handler behavior.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { _internal } = require('../workers/mtg-stripe-webhook/src/index');
const { extractPaymentData, buildHubSpotProperties, handleStripeWebhook } = _internal;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body, method = 'POST', headers = {}) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    method,
    headers: {
      get: (name) => headers[name] || null,
    },
    text: async () => bodyStr,
  };
}

function makeCheckoutEvent(overrides = {}) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        customer_email: overrides.email || 'test@example.com',
        amount_total: overrides.amount || 29500,
        currency: overrides.currency || 'cad',
        payment_intent: overrides.paymentIntent || 'pi_test_123',
        payment_status: overrides.paymentStatus || 'paid',
        id: overrides.sessionId || 'cs_test_456',
        ...overrides.session,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// extractPaymentData
// ---------------------------------------------------------------------------

describe('stripeWebhook — extractPaymentData', () => {
  it('extracts email from customer_email', () => {
    const event = makeCheckoutEvent({ email: 'marc@example.com' });
    const data = extractPaymentData(event);
    assert.equal(data.email, 'marc@example.com');
  });

  it('extracts amount and currency', () => {
    const event = makeCheckoutEvent({ amount: 29500, currency: 'cad' });
    const data = extractPaymentData(event);
    assert.equal(data.amountPaid, '29500');
    assert.equal(data.currency, 'cad');
  });

  it('extracts payment intent ID', () => {
    const event = makeCheckoutEvent({ paymentIntent: 'pi_abc123' });
    const data = extractPaymentData(event);
    assert.equal(data.paymentId, 'pi_abc123');
  });

  it('falls back to session ID when payment_intent is missing', () => {
    const event = makeCheckoutEvent({ paymentIntent: '', sessionId: 'cs_789' });
    // Need to clear payment_intent
    event.data.object.payment_intent = '';
    const data = extractPaymentData(event);
    assert.equal(data.paymentId, 'cs_789');
  });

  it('handles missing data gracefully', () => {
    const data = extractPaymentData({});
    assert.equal(data.email, '');
    assert.equal(data.amountPaid, '');
    assert.equal(data.paymentStatus, 'unknown');
  });

  it('handles null event', () => {
    const data = extractPaymentData(null);
    assert.equal(data.email, '');
  });
});

// ---------------------------------------------------------------------------
// buildHubSpotProperties
// ---------------------------------------------------------------------------

describe('stripeWebhook — buildHubSpotProperties', () => {
  it('sets payment status to Paid', () => {
    const props = buildHubSpotProperties({
      amountPaid: '29500',
      currency: 'cad',
      paymentId: 'pi_test',
    });
    assert.equal(props.mtg_payment_status, 'Paid');
  });

  it('includes amount and currency', () => {
    const props = buildHubSpotProperties({
      amountPaid: '29500',
      currency: 'cad',
      paymentId: 'pi_test',
    });
    assert.equal(props.mtg_payment_amount, '29500');
    assert.equal(props.mtg_payment_currency, 'CAD');
  });

  it('includes payment ID', () => {
    const props = buildHubSpotProperties({
      amountPaid: '29500',
      currency: 'cad',
      paymentId: 'pi_test_123',
    });
    assert.equal(props.mtg_payment_id, 'pi_test_123');
  });

  it('includes timestamp', () => {
    const props = buildHubSpotProperties({
      amountPaid: '29500',
      currency: 'cad',
      paymentId: 'pi_test',
    });
    assert.ok(props.mtg_payment_completed_at);
    assert.ok(props.mtg_payment_completed_at.includes('T'));
  });
});

// ---------------------------------------------------------------------------
// Handler — HTTP behavior
// ---------------------------------------------------------------------------

describe('stripeWebhook — handler HTTP behavior', () => {
  it('returns 204 for OPTIONS', async () => {
    const request = makeRequest('', 'OPTIONS');
    const response = await handleStripeWebhook(request, {});
    assert.equal(response.status, 204);
  });

  it('returns 405 for GET', async () => {
    const request = makeRequest('', 'GET');
    const response = await handleStripeWebhook(request, {});
    assert.equal(response.status, 405);
  });

  it('returns 200 with ignored=true for non-checkout events', async () => {
    const event = { type: 'payment_intent.succeeded', data: { object: {} } };
    const request = makeRequest(event);
    const response = await handleStripeWebhook(request, {});

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ignored, true);
  });

  it('returns 200 for valid checkout.session.completed', async () => {
    const event = makeCheckoutEvent();
    const request = makeRequest(event);
    const response = await handleStripeWebhook(request, {});

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.received, true);
    assert.equal(body.email, 'test@example.com');
  });

  it('returns 400 when no email in payment event', async () => {
    const event = makeCheckoutEvent({ email: '' });
    event.data.object.customer_email = '';
    const request = makeRequest(event);
    const response = await handleStripeWebhook(request, {});

    assert.equal(response.status, 400);
  });

  it('skips signature verification when no secret', async () => {
    const event = makeCheckoutEvent();
    const request = makeRequest(event, 'POST', {});
    const response = await handleStripeWebhook(request, {});

    assert.equal(response.status, 200);
  });
});
