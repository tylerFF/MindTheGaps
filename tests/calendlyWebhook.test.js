/**
 * MindtheGaps — Calendly Webhook unit tests
 *
 * Tests booking data extraction, HubSpot property building, and handler behavior.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { _internal } = require('../workers/mtg-calendly-webhook/src/index');
const { extractBookingData, buildHubSpotProperties, handleCalendlyWebhook } = _internal;

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

function makeCalendlyEvent(overrides = {}) {
  return {
    event: 'invitee.created',
    payload: {
      invitee: {
        email: overrides.email || 'test@example.com',
        name: overrides.name || 'Test User',
        cancel_url: overrides.cancelUrl || 'https://calendly.com/cancel/123',
        reschedule_url: overrides.rescheduleUrl || 'https://calendly.com/reschedule/123',
      },
      event: overrides.eventUri || 'https://api.calendly.com/events/abc123',
      scheduled_event: {
        start_time: overrides.startTime || '2026-02-15T14:00:00Z',
      },
      event_type: {
        name: overrides.eventType || '45-Minute Growth Scan',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// extractBookingData
// ---------------------------------------------------------------------------

describe('calendlyWebhook — extractBookingData', () => {
  it('extracts email from invitee', () => {
    const event = makeCalendlyEvent({ email: 'marc@example.com' });
    const data = extractBookingData(event);
    assert.equal(data.email, 'marc@example.com');
  });

  it('extracts name from invitee', () => {
    const event = makeCalendlyEvent({ name: 'Marc Smith' });
    const data = extractBookingData(event);
    assert.equal(data.name, 'Marc Smith');
  });

  it('extracts event URI', () => {
    const event = makeCalendlyEvent({ eventUri: 'https://api.calendly.com/events/xyz' });
    const data = extractBookingData(event);
    assert.equal(data.eventUri, 'https://api.calendly.com/events/xyz');
  });

  it('extracts scheduled time', () => {
    const event = makeCalendlyEvent({ startTime: '2026-02-20T10:00:00Z' });
    const data = extractBookingData(event);
    assert.equal(data.scheduledAt, '2026-02-20T10:00:00Z');
  });

  it('extracts cancel and reschedule URLs', () => {
    const event = makeCalendlyEvent();
    const data = extractBookingData(event);
    assert.ok(data.cancelUrl.includes('calendly.com'));
    assert.ok(data.rescheduleUrl.includes('calendly.com'));
  });

  it('handles missing data gracefully', () => {
    const data = extractBookingData({});
    assert.equal(data.email, '');
    assert.equal(data.name, '');
    assert.equal(data.scheduledAt, '');
  });

  it('handles null event', () => {
    const data = extractBookingData(null);
    assert.equal(data.email, '');
  });
});

// ---------------------------------------------------------------------------
// buildHubSpotProperties
// ---------------------------------------------------------------------------

describe('calendlyWebhook — buildHubSpotProperties', () => {
  it('sets scan booked to true', () => {
    const props = buildHubSpotProperties({
      email: 'test@example.com',
      name: 'Test',
      scheduledAt: '2026-02-15T14:00:00Z',
      eventUri: 'https://api.calendly.com/events/abc',
    });
    assert.equal(props.mtg_scan_booked, 'true');
  });

  it('includes scheduled time', () => {
    const props = buildHubSpotProperties({
      scheduledAt: '2026-02-15T14:00:00Z',
      eventUri: '',
    });
    assert.equal(props.mtg_scan_scheduled_for, '2026-02-15T14:00:00Z');
  });

  it('includes event ID', () => {
    const props = buildHubSpotProperties({
      scheduledAt: '',
      eventUri: 'https://api.calendly.com/events/abc',
    });
    assert.equal(props.mtg_calendly_event_id, 'https://api.calendly.com/events/abc');
  });

  it('includes name as first_name', () => {
    const props = buildHubSpotProperties({ name: 'Marc', scheduledAt: '', eventUri: '' });
    assert.equal(props.mtg_first_name, 'Marc');
  });

  it('omits empty optional fields', () => {
    const props = buildHubSpotProperties({ name: '', scheduledAt: '', eventUri: '' });
    assert.equal(props.mtg_first_name, undefined);
    assert.equal(props.mtg_scan_scheduled_for, undefined);
    assert.equal(props.mtg_calendly_event_id, undefined);
  });

  it('includes booked_at timestamp', () => {
    const props = buildHubSpotProperties({ scheduledAt: '', eventUri: '' });
    assert.ok(props.mtg_scan_booked_at);
    assert.ok(props.mtg_scan_booked_at.includes('T'));
  });
});

// ---------------------------------------------------------------------------
// Handler — HTTP behavior
// ---------------------------------------------------------------------------

describe('calendlyWebhook — handler HTTP behavior', () => {
  it('returns 204 for OPTIONS', async () => {
    const request = makeRequest('', 'OPTIONS');
    const response = await handleCalendlyWebhook(request, {});
    assert.equal(response.status, 204);
  });

  it('returns 405 for GET', async () => {
    const request = makeRequest('', 'GET');
    const response = await handleCalendlyWebhook(request, {});
    assert.equal(response.status, 405);
  });

  it('returns 200 with ignored=true for non-invitee events', async () => {
    const event = { event: 'invitee.canceled', payload: {} };
    const request = makeRequest(event);
    const response = await handleCalendlyWebhook(request, {});

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ignored, true);
  });

  it('returns 200 for valid invitee.created event', async () => {
    const event = makeCalendlyEvent();
    const request = makeRequest(event);
    const response = await handleCalendlyWebhook(request, {});

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.received, true);
    assert.equal(body.email, 'test@example.com');
  });

  it('returns 400 when no email in booking event', async () => {
    const event = makeCalendlyEvent({ email: '' });
    event.payload.invitee.email = '';
    const request = makeRequest(event);
    const response = await handleCalendlyWebhook(request, {});

    assert.equal(response.status, 400);
  });

  it('skips signature verification when no secret', async () => {
    const event = makeCalendlyEvent();
    const request = makeRequest(event, 'POST', {});
    const response = await handleCalendlyWebhook(request, {});

    assert.equal(response.status, 200);
  });
});
