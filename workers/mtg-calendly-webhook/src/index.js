/**
 * MindtheGaps — Calendly Webhook Handler (Cloudflare Worker)
 *
 * Receives Calendly invitee.created events, then:
 *   1. Verifies webhook signature (HMAC-SHA256 via Web Crypto)
 *   2. Parses booking data (email, event URI, scheduled time)
 *   3. Updates HubSpot contact with booking status
 *
 * Environment bindings:
 *   CALENDLY_WEBHOOK_SECRET — Calendly webhook signing key
 *   HUBSPOT_API_KEY — HubSpot private app token
 */

const { createHubSpotClient } = require('../../shared/hubspot');
const { isValidEmail, normalizeEmail } = require('../../shared/validation');

// ---------------------------------------------------------------------------
// Calendly signature verification (HMAC-SHA256 via Web Crypto)
// ---------------------------------------------------------------------------

async function verifySignature(payload, sigHeader, secret) {
  if (!secret) return true; // Skip in dev mode

  if (!sigHeader) return false;

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return expected === sigHeader;
}

// ---------------------------------------------------------------------------
// Booking data extraction
// ---------------------------------------------------------------------------

function extractBookingData(event) {
  const payload = (event && event.payload) || {};
  const invitee = payload.invitee || payload;

  return {
    email: invitee.email || '',
    name: invitee.name || '',
    eventUri: payload.event || payload.uri || '',
    scheduledAt: payload.scheduled_event?.start_time
      || payload.event_start_time
      || '',
    eventType: payload.event_type?.name || payload.event_type || '',
    cancelUrl: invitee.cancel_url || '',
    rescheduleUrl: invitee.reschedule_url || '',
  };
}

// ---------------------------------------------------------------------------
// HubSpot property builder
// ---------------------------------------------------------------------------

function buildHubSpotProperties(bookingData) {
  const props = {
    mtg_scan_booked: 'true',
    mtg_scan_booked_at: new Date().toISOString(),
  };

  if (bookingData.scheduledAt) {
    props.mtg_scan_scheduled_time = bookingData.scheduledAt;
  }
  if (bookingData.eventUri) {
    props.mtg_calendly_event_uri = bookingData.eventUri;
  }
  if (bookingData.name) {
    props.mtg_first_name = bookingData.name;
  }

  return props;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handleCalendlyWebhook(request, env) {
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
    const sigHeader = request.headers.get('Calendly-Webhook-Signature') || '';
    const isValid = await verifySignature(body, sigHeader, env.CALENDLY_WEBHOOK_SECRET);

    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(body);

    // Only handle invitee.created
    if (event.event !== 'invitee.created') {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract booking data
    const bookingData = extractBookingData(event);
    const email = normalizeEmail(bookingData.email);

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'No valid email in booking event' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build HubSpot properties
    const hubspotProps = buildHubSpotProperties(bookingData);
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
    console.error('Calendly webhook error:', err);
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
  fetch: handleCalendlyWebhook,
};

module.exports._internal = {
  verifySignature,
  extractBookingData,
  buildHubSpotProperties,
  handleCalendlyWebhook,
};
