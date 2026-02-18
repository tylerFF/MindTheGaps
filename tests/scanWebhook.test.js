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
      q2_contactEmail: 'test@example.com',
      q3_scanFirstName: 'Marc',
      q4_scanBusinessName: 'Acme Plumbing',
      q5_scanIndustry: 'HVAC',
    };
    const info = extractContactInfo(payload);

    assert.equal(info.email, 'test@example.com');
    assert.equal(info.firstName, 'Marc');
    assert.equal(info.businessName, 'Acme Plumbing');
    assert.equal(info.industry, 'HVAC');
  });

  it('skips empty fields', () => {
    const payload = { q2_contactEmail: 'test@example.com', q3_scanFirstName: '' };
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
      q9_primaryGap: 'Conversion',
      q7_quizPrimaryGap: 'Conversion',
      q11_subPathConversion: 'Speed-to-lead',
      q36_oneLeverConversion: 'Response ownership',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.primaryGap, 'Conversion');
    assert.equal(scan.quizPrimaryGap, 'Conversion');
    assert.equal(scan.subPath, 'Speed-to-lead');
    assert.equal(scan.oneLever, 'Response ownership');
  });

  it('extracts baseline fields via field map', () => {
    const payload = {
      q9_primaryGap: 'Conversion',
      q15_convInboundLeads: '11-25',
      q16_convFirstResponseTime: 'same day',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.baselineFields.conv_inbound_leads, '11-25');
    assert.equal(scan.baselineFields.conv_first_response_time, 'same day');
  });

  it('extracts 6 action slots', () => {
    const payload = {
      q9_primaryGap: 'Conversion',
      q41_action1Desc: 'Set up auto-response',
      q42_action1Owner: 'Marc',
      q43_action1Due: 'Week 1',
      q44_action2Desc: 'Follow-up sequence',
      q45_action2Owner: 'VA',
      q46_action2Due: 'Week 1',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.actions.length, 6);
    assert.equal(scan.actions[0].description, 'Set up auto-response');
    assert.equal(scan.actions[0].owner, 'Marc');
    assert.equal(scan.actions[1].description, 'Follow-up sequence');
    // Slots 3-6 should be empty strings
    assert.equal(scan.actions[2].description, '');
  });

  it('extracts metrics from checkbox field', () => {
    const payload = {
      q9_primaryGap: 'Conversion',
      q60_metricsConversion: 'Median response time\nLead to booked %',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.metrics.length, 2);
    assert.equal(scan.metrics[0], 'Median response time');
    assert.equal(scan.metrics[1], 'Lead to booked %');
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
      q9_primaryGap: 'Acquisition',
      q22_acqInboundLeads: '11-25',
      q23_acqTopSourceDep: '2 sources',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.baselineFields.acq_inbound_leads, '11-25');
    assert.equal(scan.baselineFields.acq_top_source_dependence, '2 sources');
  });

  it('handles Retention baseline fields', () => {
    const payload = {
      q9_primaryGap: 'Retention',
      q29_retPctRevenueRepeat: '21-40%',
      q32_retReviewsPerMonth: '1-2',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.baselineFields.ret_pct_revenue_repeat, '21-40%');
    assert.equal(scan.baselineFields.ret_reviews_per_month, '1-2');
  });

  it('picks sub-path based on confirmed primary gap', () => {
    const payload = {
      q9_primaryGap: 'Acquisition',
      q11_subPathConversion: 'Speed-to-lead',
      q12_subPathAcquisition: 'Channel concentration risk',
      q13_subPathRetention: 'Rebook/recall gap',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.subPath, 'Channel concentration risk');
  });

  it('picks one lever based on confirmed primary gap', () => {
    const payload = {
      q9_primaryGap: 'Retention',
      q36_oneLeverConversion: 'Response ownership',
      q38_oneLeverRetention: 'Rebook/recall system (prompt + script + schedule)',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.oneLever, 'Rebook/recall system (prompt + script + schedule)');
  });

  it('extracts constraints', () => {
    const payload = {
      q9_primaryGap: 'Conversion',
      q64_constraint1: 'Budget limited',
      q65_constraint2: 'Small team',
    };
    const scan = extractScanData(payload);

    assert.equal(scan.constraints.length, 2);
    assert.equal(scan.constraints[0], 'Budget limited');
    assert.equal(scan.constraints[1], 'Small team');
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
    assert.equal(props.mtg_scan_primary_gap_confirmed, 'Conversion');
    assert.equal(props.mtg_scan_sub_path, 'Speed-to-lead');
    assert.equal(props.mtg_scan_confidence, 'High');
    assert.equal(props.mtg_plan_draft_link, 'https://r2.example.com/plan.docx');
    assert.equal(props.mtg_plan_review_status, 'Pending');
    assert.ok(props.mtg_plan_drafted_at);
    assert.equal(props.mtg_plan_status, 'Draft');
    assert.equal(props.mtg_plan_generation_mode, 'Auto');
  });

  it('builds stopped properties', () => {
    const scanData = { primaryGap: 'Conversion', subPath: 'Other (manual)', oneLever: '' };
    const stopResult = { stopped: true, reasons: ['Sub-path requires manual plan'] };
    const props = buildHubSpotProperties(scanData, null, null, stopResult);

    assert.equal(props.mtg_scan_stop_reason, 'Sub-path requires manual plan');
    assert.equal(props.mtg_plan_review_status, 'Manual Required');
    assert.equal(props.mtg_plan_draft_link, undefined);
    assert.equal(props.mtg_plan_generation_mode, 'Stopped');
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
    const request = makeRequest({ q9_primaryGap: 'Conversion' });
    const response = await handleScanWebhook(request, {}, null);

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.ok(body.error.includes('email'));
  });

  it('returns success with stopped=true when stop rules fire', async () => {
    const request = makeRequest({
      q2_contactEmail: 'test@example.com',
      q9_primaryGap: 'Conversion',
      q11_subPathConversion: 'Other (manual)',
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
      q2_contactEmail: 'test@example.com',
      q9_primaryGap: 'Conversion',
      q7_quizPrimaryGap: 'Conversion',
      q11_subPathConversion: 'Speed-to-lead',
      q36_oneLeverConversion: 'Response ownership + SLA + follow-up sequence',
      // 7 baseline fields (all answered)
      q15_convInboundLeads: '11-25',
      q16_convFirstResponseTime: 'same day',
      q17_convLeadToBooked: '21-40%',
      q18_convBookedToShow: '61-80%',
      q19_convTimeToFirstAppt: '1-3 days',
      q20_convQuoteSentTimeline: '48 hours',
      q21_convQuoteToClose: '21-30%',
      // 6 actions
      q41_action1Desc: 'Set up auto-response within 15 min', q42_action1Owner: 'Marc', q43_action1Due: 'Week 1',
      q44_action2Desc: 'Create follow-up email sequence', q45_action2Owner: 'Marc', q46_action2Due: 'Week 1',
      q47_action3Desc: 'Add booking link to all touchpoints', q48_action3Owner: 'VA', q49_action3Due: 'Week 2',
      q50_action4Desc: 'Set calendar reminder for quote follow-up', q51_action4Owner: 'Marc', q52_action4Due: 'Week 2',
      q53_action5Desc: 'Build after-quote text template', q54_action5Owner: 'VA', q55_action5Due: 'Week 3',
      q56_action6Desc: 'Install call tracking on website', q57_action6Owner: 'Marc', q58_action6Due: 'Week 4',
      // 3 metrics (checkbox field, newline-separated)
      q60_metricsConversion: 'Median response time\nLead to booked %\nShow rate %',
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
    const request = makeRequest({ q2_contactEmail: 'test@example.com' });
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
