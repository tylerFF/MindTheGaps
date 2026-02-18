/**
 * MindtheGaps — Stripe Webhook Handler (Cloudflare Worker)
 *
 * Receives Stripe checkout.session.completed events, then:
 *   1. Verifies webhook signature (HMAC-SHA256 via Web Crypto)
 *   2. Parses payment data (email, amount, payment ID)
 *   3. Updates HubSpot contact with payment status
 *
 * Environment bindings:
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret
 *   HUBSPOT_API_KEY — HubSpot private app token
 */

const { createHubSpotClient } = require('../../shared/hubspot');
const { isValidEmail, normalizeEmail } = require('../../shared/validation');

// ---------------------------------------------------------------------------
// Stripe signature verification (Web Crypto HMAC-SHA256)
// ---------------------------------------------------------------------------

async function verifySignature(payload, sigHeader, secret) {
  if (!secret) return true; // Skip in dev mode

  const parts = {};
  for (const item of sigHeader.split(',')) {
    const [key, value] = item.split('=');
    parts[key] = value;
  }

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return expected === signature;
}

// ---------------------------------------------------------------------------
// Payment data extraction
// ---------------------------------------------------------------------------

function extractPaymentData(event) {
  const session = (event && event.data && event.data.object) || {};

  return {
    email: session.customer_email || session.customer_details?.email || '',
    amountPaid: session.amount_total ? String(session.amount_total) : '',
    currency: session.currency || 'cad',
    paymentId: session.payment_intent || session.id || '',
    paymentStatus: session.payment_status || 'unknown',
  };
}

// ---------------------------------------------------------------------------
// HubSpot property builder
// ---------------------------------------------------------------------------

function buildHubSpotProperties(paymentData) {
  return {
    mtg_payment_status: 'Paid',
    mtg_payment_amount: paymentData.amountPaid,
    mtg_payment_currency: paymentData.currency.toUpperCase(),
    mtg_stripe_payment_id: paymentData.paymentId,
    mtg_payment_date: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handleStripeWebhook(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.text();

    // Verify signature
    const sigHeader = request.headers.get('Stripe-Signature') || '';
    const isValid = await verifySignature(body, sigHeader, env.STRIPE_WEBHOOK_SECRET);

    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(body);

    // Only handle checkout.session.completed
    if (event.type !== 'checkout.session.completed') {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract payment data
    const paymentData = extractPaymentData(event);
    const email = normalizeEmail(paymentData.email);

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'No valid email in payment event' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build HubSpot properties
    const hubspotProps = buildHubSpotProperties(paymentData);
    let hubspotStatus = 'skipped';

    if (env.HUBSPOT_API_KEY) {
      try {
        const client = createHubSpotClient(env.HUBSPOT_API_KEY);
        const result = await client.upsertContact(email, hubspotProps);
        hubspotStatus = result.created ? 'created' : 'updated';
      } catch (err) {
        console.error('HubSpot write failed:', err.message);
        hubspotStatus = 'error';
      }
    }

    return new Response(JSON.stringify({
      received: true,
      email,
      hubspotStatus,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

module.exports = {
  fetch: handleStripeWebhook,
};

module.exports._internal = {
  verifySignature,
  extractPaymentData,
  buildHubSpotProperties,
  handleStripeWebhook,
};
