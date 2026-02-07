/**
 * MindtheGaps — Scan Webhook index.js unit tests
 *
 * Tests extractScanData, buildHubSpotProperties, and handler behavior.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { _internal } = require('../workers/mtg-scan-webhook/src/index');
const { PILLARS, BASELINE_FIELDS } = require('../workers/shared/constants');

const {
  extractContactInfo,
  extractScanData,
  buildHubSpotProperties,
  handleScanWebhook,
  JOTFORM_SCAN_FIELD_MAP,
} = _internal;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body, method = 'POST', contentType = 'application/json') {
  return {
    method,
    headers: {
      get: (name) => {
        if (name === 'Content-Type') return contentType;
        return null;
      },
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function highConfidence() {
  return { level: 'High', notSureCount: 0, totalFields: 7, answeredCount: 7, includeConstraints: false, includeDataGaps: false };
}

function medConfidence() {
  return { level: 'Med', notSureCount: 2, totalFields: 7, answeredCount: 5, includeConstraints: true, includeDataGaps: false };
}

// ---------------------------------------------------------------------------
// extractContactInfo
// ---------------------------------------------------------------------------

describe('scanWebhook — extractContactInfo', () => {
  it('extracts contact fields from payload', () => {
    const payload = {
      s_email: 'test@example.com',
      s_first_name: 'Marc',
      s_business_name: 'Acme Plumbing',
      s_industry: 'HVAC',
    };
    const info = extractContactInfo(payload);

    assert.equal(info.email, 'test@example.com');
    assert.equal(info.firstName, 'Marc');
    assert.equal(info.businessName, 'Acme Plumbing');
    assert.equal(info.industry, 'HVAC');
  });

  it('skips empty fields', () => {
    const payload = { s_email: 'test@example.com', s_first_name: '' };
    const info = extractContactInfo(payload);

    assert.equal(info.email, 'test@example.com');
    assert.equal(info.firstName, undefined);
  });

  it('returns empty object for empty payload', () => {
    const info = extractContactInfo({});
    assert.deepEqual(info, {});
  });
});

// ---------------------------------------------------------------------------
// extractScanData
// ---------------------------------------------------------------------------

describe('scanWebhook — extractScanData', () => {
  it('extracts core scan fields', () => {
    const payload = {
      s_primary_gap: 'Conversion',
      s_quiz_primary_gap: 'Conversion',
      s_sub_path: 'Speed-to-lead',
      s_one_lever: 'Response ownership',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.primaryGap, 'Conversion');
    assert.equal(scan.quizPrimaryGap, 'Conversion');
    assert.equal(scan.subPath, 'Speed-to-lead');
    assert.equal(scan.oneLever, 'Response ownership');
  });

  it('extracts baseline fields via field map', () => {
    const payload = {
      s_primary_gap: 'Conversion',
      s_conv_inbound_leads: '11-25',
      s_conv_first_response_time: 'same day',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.baselineFields.conv_inbound_leads, '11-25');
    assert.equal(scan.baselineFields.conv_first_response_time, 'same day');
  });

  it('extracts 6 action slots', () => {
    const payload = {
      s_primary_gap: 'Conversion',
      s_action_1_desc: 'Set up auto-response',
      s_action_1_owner: 'Marc',
      s_action_1_due: 'Week 1',
      s_action_2_desc: 'Follow-up sequence',
      s_action_2_owner: 'VA',
      s_action_2_due: 'Week 1',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.actions.length, 6);
    assert.equal(scan.actions[0].description, 'Set up auto-response');
    assert.equal(scan.actions[0].owner, 'Marc');
    assert.equal(scan.actions[1].description, 'Follow-up sequence');
    // Slots 3-6 should be empty strings
    assert.equal(scan.actions[2].description, '');
  });

  it('extracts metrics', () => {
    const payload = {
      s_primary_gap: 'Conversion',
      s_metric_1: 'Response time (hours)',
      s_metric_2: 'Lead-to-booked rate (%)',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.metrics.length, 2);
    assert.equal(scan.metrics[0], 'Response time (hours)');
    assert.equal(scan.metrics[1], 'Lead-to-booked rate (%)');
  });

  it('defaults missing fields to empty strings', () => {
    const scan = extractScanData({});

    assert.equal(scan.primaryGap, '');
    assert.equal(scan.subPath, '');
    assert.equal(scan.oneLever, '');
    assert.equal(scan.gapChangeReason, '');
  });

  it('handles Acquisition baseline fields', () => {
    const payload = {
      s_primary_gap: 'Acquisition',
      s_acq_inbound_leads: '11-25',
      s_acq_top_source_dependence: '2 sources',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.baselineFields.acq_inbound_leads, '11-25');
    assert.equal(scan.baselineFields.acq_top_source_dependence, '2 sources');
  });

  it('handles Retention baseline fields', () => {
    const payload = {
      s_primary_gap: 'Retention',
      s_ret_pct_revenue_repeat: '21-40%',
      s_ret_reviews_per_month: '1-2',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.baselineFields.ret_pct_revenue_repeat, '21-40%');
    assert.equal(scan.baselineFields.ret_reviews_per_month, '1-2');
  });
});

// ---------------------------------------------------------------------------
// buildHubSpotProperties
// ---------------------------------------------------------------------------

describe('scanWebhook — buildHubSpotProperties', () => {
  it('builds success properties', () => {
    const scanData = { primaryGap: 'Conversion', subPath: 'Speed-to-lead', oneLever: 'Response ownership' };
    const props = buildHubSpotProperties(scanData, highConfidence(), 'https://r2.example.com/plan.docx', null);

    assert.equal(props.mtg_scan_completed, 'true');
    assert.equal(props.mtg_primary_gap_confirmed, 'Conversion');
    assert.equal(props.mtg_sub_path, 'Speed-to-lead');
    assert.equal(props.mtg_confidence_level, 'High');
    assert.equal(props.mtg_plan_url, 'https://r2.example.com/plan.docx');
    assert.equal(props.mtg_plan_review_status, 'Pending Review');
  });

  it('builds stopped properties', () => {
    const scanData = { primaryGap: 'Conversion', subPath: 'Other (manual)', oneLever: '' };
    const stopResult = { stopped: true, reasons: ['Sub-path requires manual plan'] };
    const props = buildHubSpotProperties(scanData, null, null, stopResult);

    assert.equal(props.mtg_scan_stop_reason, 'Sub-path requires manual plan');
    assert.equal(props.mtg_plan_review_status, 'Manual Required');
    assert.equal(props.mtg_plan_url, undefined);
  });

  it('includes confidence not sure count', () => {
    const scanData = { primaryGap: 'Conversion', subPath: 'Speed-to-lead', oneLever: 'Fix' };
    const props = buildHubSpotProperties(scanData, medConfidence(), null, null);

    assert.equal(props.mtg_confidence_not_sure_count, '2');
  });

  it('joins multiple stop reasons with pipe separator', () => {
    const scanData = { primaryGap: '', subPath: '', oneLever: '' };
    const stopResult = { stopped: true, reasons: ['Missing primary gap', 'Missing sub-path'] };
    const props = buildHubSpotProperties(scanData, null, null, stopResult);

    assert.ok(props.mtg_scan_stop_reason.includes('|'));
    assert.ok(props.mtg_scan_stop_reason.includes('Missing primary gap'));
    assert.ok(props.mtg_scan_stop_reason.includes('Missing sub-path'));
  });
});

// ---------------------------------------------------------------------------
// Handler — HTTP behavior
// ---------------------------------------------------------------------------

describe('scanWebhook — handler HTTP behavior', () => {
  it('returns 204 for OPTIONS (CORS preflight)', async () => {
    const request = makeRequest(null, 'OPTIONS');
    const response = await handleScanWebhook(request, {}, null);

    assert.equal(response.status, 204);
  });

  it('returns 405 for GET', async () => {
    const request = makeRequest(null, 'GET');
    const response = await handleScanWebhook(request, {}, null);

    assert.equal(response.status, 405);
  });

  it('returns 400 for missing email', async () => {
    const request = makeRequest({ s_primary_gap: 'Conversion' });
    const response = await handleScanWebhook(request, {}, null);

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes('email'));
  });

  it('returns success with stopped=true when stop rules fire', async () => {
    const request = makeRequest({
      s_email: 'test@example.com',
      s_primary_gap: 'Conversion',
      s_sub_path: 'Other (manual)',
    });
    const response = await handleScanWebhook(request, {}, null);

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.stopped, true);
    assert.ok(body.reasons.length > 0);
  });

  it('returns success with stopped=false for valid scan (no API keys)', async () => {
    // Build a valid payload that passes stop rules
    const payload = {
      s_email: 'test@example.com',
      s_primary_gap: 'Conversion',
      s_quiz_primary_gap: 'Conversion',
      s_sub_path: 'Speed-to-lead',
      s_one_lever: 'Response ownership + SLA + follow-up sequence',
      // 7 baseline fields (all answered)
      s_conv_inbound_leads: '11-25',
      s_conv_first_response_time: 'same day',
      s_conv_lead_to_booked: '21-40%',
      s_conv_booked_to_show: '61-80%',
      s_conv_time_to_first_appointment: '1-3 days',
      s_conv_quote_sent_timeline: '48 hours',
      s_conv_quote_to_close: '21-30%',
      // 6 actions
      s_action_1_desc: 'Set up auto-response within 15 min', s_action_1_owner: 'Marc', s_action_1_due: 'Week 1',
      s_action_2_desc: 'Create follow-up email sequence', s_action_2_owner: 'Marc', s_action_2_due: 'Week 1',
      s_action_3_desc: 'Add booking link to all touchpoints', s_action_3_owner: 'VA', s_action_3_due: 'Week 2',
      s_action_4_desc: 'Set calendar reminder for quote follow-up', s_action_4_owner: 'Marc', s_action_4_due: 'Week 2',
      s_action_5_desc: 'Build after-quote text template', s_action_5_owner: 'VA', s_action_5_due: 'Week 3',
      s_action_6_desc: 'Install call tracking on website', s_action_6_owner: 'Marc', s_action_6_due: 'Week 4',
      // 3 metrics
      s_metric_1: 'Response time (hours)',
      s_metric_2: 'Lead-to-booked rate (%)',
      s_metric_3: 'Quote-to-close rate (%)',
    };
    const request = makeRequest(payload);
    const response = await handleScanWebhook(request, {}, null);

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.stopped, false);
    assert.equal(body.confidence, 'High');
    // No plan URL since no API keys
    assert.equal(body.planUrl, null);
  });

  it('includes CORS headers in response', async () => {
    const request = makeRequest({ s_email: 'test@example.com' });
    const response = await handleScanWebhook(request, {}, null);

    assert.ok(response.headers.get('Access-Control-Allow-Origin'));
  });
});

// ---------------------------------------------------------------------------
// JOTFORM_SCAN_FIELD_MAP
// ---------------------------------------------------------------------------

describe('scanWebhook — JOTFORM_SCAN_FIELD_MAP', () => {
  it('has baseline entries for all Conversion fields', () => {
    for (const key of BASELINE_FIELDS[PILLARS.CONVERSION]) {
      assert.ok(
        Object.values(JOTFORM_SCAN_FIELD_MAP.baseline).includes(key),
        `Missing baseline mapping for ${key}`,
      );
    }
  });

  it('has baseline entries for all Acquisition fields', () => {
    for (const key of BASELINE_FIELDS[PILLARS.ACQUISITION]) {
      assert.ok(
        Object.values(JOTFORM_SCAN_FIELD_MAP.baseline).includes(key),
        `Missing baseline mapping for ${key}`,
      );
    }
  });

  it('has baseline entries for all Retention fields', () => {
    for (const key of BASELINE_FIELDS[PILLARS.RETENTION]) {
      assert.ok(
        Object.values(JOTFORM_SCAN_FIELD_MAP.baseline).includes(key),
        `Missing baseline mapping for ${key}`,
      );
    }
  });
});
