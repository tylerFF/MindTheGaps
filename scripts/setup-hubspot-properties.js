#!/usr/bin/env node
/**
 * MindtheGaps — HubSpot Property Setup Script
 *
 * Creates all mtg_ custom contact properties in HubSpot.
 * Run once during project setup, or re-run safely (skips existing properties).
 *
 * Usage:
 *   HUBSPOT_API_KEY=your_token node scripts/setup-hubspot-properties.js
 *
 * Requires: Node 18+ (uses native fetch)
 */

const API_BASE = 'https://api.hubapi.com/crm/v3/properties/contacts';
const GROUP_NAME = 'mindthegaps';
const GROUP_LABEL = 'MindtheGaps';

// ---------------------------------------------------------------------------
// Property definitions — matches PROJECT_CONTEXT.md Section 2
// ---------------------------------------------------------------------------

const PROPERTIES = [
  // --- Profile Fields ---
  { name: 'mtg_first_name', label: 'MTG First Name', type: 'string', fieldType: 'text' },
  { name: 'mtg_business_name', label: 'MTG Business Name', type: 'string', fieldType: 'text' },
  {
    name: 'mtg_industry', label: 'MTG Industry', type: 'enumeration', fieldType: 'select',
    options: [
      'HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Landscaping', 'Painting',
      'Cleaning', 'Pest Control', 'General Contractor', 'Auto Repair', 'Dental',
      'Chiropractic', 'Veterinary', 'Legal', 'Accounting', 'Real Estate', 'Other',
    ],
  },
  {
    name: 'mtg_location', label: 'MTG Location', type: 'enumeration', fieldType: 'select',
    options: ['Ontario', 'Elsewhere in Canada', 'United States', 'Other'],
  },
  {
    name: 'mtg_team_size', label: 'MTG Team Size', type: 'enumeration', fieldType: 'select',
    options: ['<10', '10-24', '25-49', '50-100', '100+'],
  },
  { name: 'mtg_website_url', label: 'MTG Website URL', type: 'string', fieldType: 'text' },
  { name: 'mtg_phone', label: 'MTG Phone', type: 'string', fieldType: 'phonenumber' },

  // --- Quiz Output Fields ---
  { name: 'mtg_quiz_completed', label: 'MTG Quiz Completed', type: 'enumeration', fieldType: 'booleancheckbox', options: ['true', 'false'] },
  { name: 'mtg_quiz_completed_at', label: 'MTG Quiz Completed At', type: 'datetime', fieldType: 'date' },
  {
    name: 'mtg_primary_gap', label: 'MTG Primary Gap', type: 'enumeration', fieldType: 'select',
    options: ['Acquisition', 'Conversion', 'Retention'],
  },
  { name: 'mtg_quiz_score', label: 'MTG Quiz Score', type: 'number', fieldType: 'number' },
  { name: 'mtg_sub_diagnosis', label: 'MTG Sub-Diagnosis', type: 'string', fieldType: 'text' },
  { name: 'mtg_key_signals', label: 'MTG Key Signals', type: 'string', fieldType: 'textarea' },
  { name: 'mtg_cost_of_leak', label: 'MTG Cost of Leak', type: 'string', fieldType: 'text' },
  { name: 'mtg_scan_eligible', label: 'MTG Scan Eligible', type: 'enumeration', fieldType: 'booleancheckbox', options: ['true', 'false'] },
  { name: 'mtg_fix_first_reason', label: 'MTG Fix First Reason', type: 'string', fieldType: 'text' },

  // --- Quiz Raw Answer Fields (13 questions) ---
  { name: 'mtg_quiz_v1', label: 'MTG Quiz V1', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_v2', label: 'MTG Quiz V2', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_v3', label: 'MTG Quiz V3', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_v4', label: 'MTG Quiz V4', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_v5', label: 'MTG Quiz V5', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_a1', label: 'MTG Quiz A1', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_c1', label: 'MTG Quiz C1', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_c2', label: 'MTG Quiz C2', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_c3', label: 'MTG Quiz C3', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_c4', label: 'MTG Quiz C4', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_r1', label: 'MTG Quiz R1', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_r2', label: 'MTG Quiz R2', type: 'string', fieldType: 'text' },
  { name: 'mtg_quiz_r3', label: 'MTG Quiz R3', type: 'string', fieldType: 'text' },

  // --- Payment Fields ---
  {
    name: 'mtg_payment_status', label: 'MTG Payment Status', type: 'enumeration', fieldType: 'select',
    options: ['Pending', 'Paid', 'Refunded'],
  },
  { name: 'mtg_payment_amount', label: 'MTG Payment Amount', type: 'number', fieldType: 'number' },
  { name: 'mtg_payment_currency', label: 'MTG Payment Currency', type: 'string', fieldType: 'text' },
  { name: 'mtg_payment_date', label: 'MTG Payment Date', type: 'datetime', fieldType: 'date' },
  { name: 'mtg_stripe_payment_id', label: 'MTG Stripe Payment ID', type: 'string', fieldType: 'text' },

  // --- Booking Fields ---
  { name: 'mtg_scan_booked', label: 'MTG Scan Booked', type: 'enumeration', fieldType: 'booleancheckbox', options: ['true', 'false'] },
  { name: 'mtg_scan_booked_at', label: 'MTG Scan Booked At', type: 'datetime', fieldType: 'date' },
  { name: 'mtg_scan_scheduled_for', label: 'MTG Scan Scheduled For', type: 'datetime', fieldType: 'date' },
  { name: 'mtg_calendly_event_id', label: 'MTG Calendly Event ID', type: 'string', fieldType: 'text' },

  // --- Scan Output Fields ---
  { name: 'mtg_scan_completed', label: 'MTG Scan Completed', type: 'enumeration', fieldType: 'booleancheckbox', options: ['true', 'false'] },
  { name: 'mtg_scan_completed_at', label: 'MTG Scan Completed At', type: 'datetime', fieldType: 'date' },
  {
    name: 'mtg_scan_primary_gap_confirmed', label: 'MTG Scan Primary Gap Confirmed', type: 'enumeration', fieldType: 'select',
    options: ['Acquisition', 'Conversion', 'Retention'],
  },
  { name: 'mtg_scan_sub_path', label: 'MTG Scan Sub-Path', type: 'string', fieldType: 'text' },
  { name: 'mtg_scan_one_lever', label: 'MTG Scan One Lever', type: 'string', fieldType: 'text' },
  { name: 'mtg_scan_one_lever_sentence', label: 'MTG Scan One Lever Sentence', type: 'string', fieldType: 'textarea' },
  {
    name: 'mtg_scan_confidence', label: 'MTG Scan Confidence', type: 'enumeration', fieldType: 'select',
    options: ['High', 'Med', 'Low'],
  },
  { name: 'mtg_confidence_not_sure_count', label: 'MTG Confidence Not Sure Count', type: 'number', fieldType: 'number' },
  { name: 'mtg_scan_stop_reason', label: 'MTG Scan Stop Reason', type: 'string', fieldType: 'text' },

  // --- Plan Fields ---
  { name: 'mtg_plan_draft_link', label: 'MTG Plan Draft Link', type: 'string', fieldType: 'text' },
  { name: 'mtg_plan_drafted_at', label: 'MTG Plan Drafted At', type: 'datetime', fieldType: 'date' },
  {
    name: 'mtg_plan_review_status', label: 'MTG Plan Review Status', type: 'enumeration', fieldType: 'select',
    options: ['Pending', 'Approved', 'Rejected', 'Manual Required'],
  },
  { name: 'mtg_plan_reviewer_notes', label: 'MTG Plan Reviewer Notes', type: 'string', fieldType: 'textarea' },
  { name: 'mtg_plan_sent_at', label: 'MTG Plan Sent At', type: 'datetime', fieldType: 'date' },
  {
    name: 'mtg_plan_status', label: 'MTG Plan Status', type: 'enumeration', fieldType: 'select',
    options: ['Draft', 'Reviewed', 'Sent'],
  },
  {
    name: 'mtg_plan_generation_mode', label: 'MTG Plan Generation Mode', type: 'enumeration', fieldType: 'select',
    options: ['Auto', 'Stopped'],
  },
];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function createPropertyGroup(apiKey) {
  const res = await fetch('https://api.hubapi.com/crm/v3/properties/contacts/groups', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: GROUP_NAME, label: GROUP_LABEL }),
  });

  if (res.status === 409) {
    console.log(`  Property group "${GROUP_NAME}" already exists — OK`);
    return;
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create property group: ${res.status} ${err}`);
  }
  console.log(`  Created property group "${GROUP_NAME}"`);
}

async function createProperty(apiKey, prop) {
  const body = {
    name: prop.name,
    label: prop.label,
    type: prop.type,
    fieldType: prop.fieldType,
    groupName: GROUP_NAME,
  };

  // Add options for enumeration types
  if (prop.options) {
    body.options = prop.options.map((value, i) => ({
      label: value,
      value,
      displayOrder: i,
      hidden: false,
    }));
  }

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    return { status: 'exists', name: prop.name };
  }
  if (!res.ok) {
    const err = await res.text();
    return { status: 'error', name: prop.name, error: `${res.status} ${err}` };
  }
  return { status: 'created', name: prop.name };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.HUBSPOT_API_KEY;
  if (!apiKey) {
    console.error('Error: HUBSPOT_API_KEY environment variable is required.');
    console.error('Usage: HUBSPOT_API_KEY=your_token node scripts/setup-hubspot-properties.js');
    process.exit(1);
  }

  console.log(`\nMindtheGaps — HubSpot Property Setup`);
  console.log(`Creating ${PROPERTIES.length} properties in group "${GROUP_NAME}"...\n`);

  // 1. Create property group
  console.log('Step 1: Property group');
  await createPropertyGroup(apiKey);

  // 2. Create properties (sequential to avoid rate limits)
  console.log('\nStep 2: Creating properties...');
  let created = 0;
  let existed = 0;
  let errors = 0;

  for (const prop of PROPERTIES) {
    const result = await createProperty(apiKey, prop);
    if (result.status === 'created') {
      console.log(`  + ${prop.name}`);
      created++;
    } else if (result.status === 'exists') {
      console.log(`  . ${prop.name} (already exists)`);
      existed++;
    } else {
      console.error(`  ! ${prop.name} — ${result.error}`);
      errors++;
    }
  }

  console.log(`\nDone: ${created} created, ${existed} already existed, ${errors} errors.`);
  if (errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
