#!/usr/bin/env node
/**
 * JotForm Scan Worksheet — Predetermined Actions Setup
 *
 * Creates 84 locked dropdown fields (14 sub-paths x 6 action slots),
 * sets conditional logic to show the right 6 based on confirmed sub-path,
 * updates sublabels on shared owner/due fields, and hides old shared
 * description fields.
 *
 * Usage:
 *   JOTFORM_API_KEY=<key> node scripts/jotform-scan-setup.js
 *
 * Requires: Node.js 18+ (uses native fetch)
 */

const { PREDETERMINED_ACTIONS, STEP5_HELPER_NARRATION, STEP5_WHAT_WE_FIX } = require('../workers/mtg-scan-webhook/src/planGenerator')._internal;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_KEY = process.env.JOTFORM_API_KEY;
if (!API_KEY) {
  console.error('Error: Set JOTFORM_API_KEY environment variable');
  process.exit(1);
}

const FORM_ID = '260435948553162';
const BASE_URL = `https://eu-api.jotform.com`;

// Sub-path field IDs by pillar
const SUB_PATH_FIELDS = {
  Conversion: '11',
  Acquisition: '12',
  Retention: '13',
};

// Existing shared action description field QIDs (to be hidden)
const OLD_DESC_QIDS = ['41', '44', '47', '50', '53', '56'];

// Existing "What we fix first" free-text field QID (to be hidden)
const OLD_WHAT_WE_FIX_QID = '39';

// Existing shared owner field QIDs (sublabels to update)
const OWNER_QIDS = ['42', '45', '48', '51', '54', '57'];

// Existing shared due field QIDs (sublabels to update)
const DUE_QIDS = ['43', '46', '49', '52', '55', '58'];

// Sub-path key -> pillar mapping
const SUB_PATH_PILLAR = {
  'Channel concentration risk': 'Acquisition',
  'Lead capture friction': 'Acquisition',
  'Demand capture / local visibility': 'Acquisition',
  'Lead tracking + ownership gap': 'Acquisition',
  'Speed-to-lead': 'Conversion',
  'Booking friction': 'Conversion',
  'Show rate': 'Conversion',
  'Quote follow-up / decision drop-off': 'Conversion',
  'Stage clarity + follow-up consistency gap': 'Conversion',
  'Rebook/recall gap': 'Retention',
  'Review rhythm gap': 'Retention',
  'Referral ask gap': 'Retention',
  'Post-service follow-up gap': 'Retention',
  'Value review / renewal alignment gap': 'Retention',
};

// Short code for field naming
const SUB_PATH_SHORT = {
  'Channel concentration risk': 'A1',
  'Lead capture friction': 'A2',
  'Demand capture / local visibility': 'A3',
  'Lead tracking + ownership gap': 'A4',
  'Speed-to-lead': 'C1',
  'Booking friction': 'C2',
  'Show rate': 'C3',
  'Quote follow-up / decision drop-off': 'C4',
  'Stage clarity + follow-up consistency gap': 'C5',
  'Rebook/recall gap': 'R1',
  'Review rhythm gap': 'R2',
  'Referral ask gap': 'R3',
  'Post-service follow-up gap': 'R4',
  'Value review / renewal alignment gap': 'R5',
};

// Sub-path value as it appears in the JotForm dropdown
function jotformSubPathValue(key) {
  return key;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiCall(method, path, body) {
  const url = `${BASE_URL}${path}?apiKey=${API_KEY}`;
  const opts = { method, headers: {} };

  if (body) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = typeof body === 'string' ? body : new URLSearchParams(body).toString();
  }

  const res = await fetch(url, opts);
  const json = await res.json();

  if (json.responseCode !== 200) {
    throw new Error(`API ${method} ${path}: ${json.message} (${json.responseCode})`);
  }
  return json.content;
}

async function createQuestion(properties) {
  const params = {};
  for (const [k, v] of Object.entries(properties)) {
    params[`question[${k}]`] = v;
  }
  return apiCall('POST', `/form/${FORM_ID}/questions`, params);
}

async function updateQuestion(qid, properties) {
  const params = {};
  for (const [k, v] of Object.entries(properties)) {
    params[`question[${k}]`] = v;
  }
  return apiCall('POST', `/form/${FORM_ID}/question/${qid}`, params);
}

async function getFormProperties() {
  return apiCall('GET', `/form/${FORM_ID}/properties`);
}

async function setFormProperties(body) {
  return apiCall('POST', `/form/${FORM_ID}/properties`, body);
}

// ---------------------------------------------------------------------------
// Step 1: Create 84 locked dropdown fields
// ---------------------------------------------------------------------------

async function createLockedDropdowns() {
  console.log('\n=== Step 1: Creating 84 locked dropdown fields ===\n');

  const createdFields = {}; // subPathKey -> [qid1, qid2, ... qid6]

  for (const [subPathKey, actions] of Object.entries(PREDETERMINED_ACTIONS)) {
    const shortCode = SUB_PATH_SHORT[subPathKey];
    createdFields[subPathKey] = [];

    for (let i = 0; i < 6; i++) {
      const action = actions[i];
      const name = `Action ${i + 1} \u2014 ${shortCode}: ${subPathKey.replace(/:.*/, '')}`;

      try {
        const result = await createQuestion({
          type: 'control_dropdown',
          text: name,
          required: 'No',
          sublabel: action.helperNarration,
          options: action.description, // Single option = locked
          special: 'None',
        });

        const qid = typeof result === 'object' ? Object.keys(result)[0] : result;
        createdFields[subPathKey].push(qid);
        console.log(`  Created: ${name} -> qid ${qid}`);
      } catch (err) {
        console.error(`  FAILED: ${name} -> ${err.message}`);
        createdFields[subPathKey].push(null);
      }

      // Rate limit: JotForm allows ~20 req/min on free plan
      await sleep(500);
    }
  }

  return createdFields;
}

// ---------------------------------------------------------------------------
// Step 1b: Create 14 locked "What we fix first" dropdowns
// ---------------------------------------------------------------------------

async function createWhatWeFixDropdowns() {
  console.log('\n=== Step 1b: Creating 14 "What we fix first" locked dropdowns ===\n');

  const createdFields = {}; // subPathKey -> qid

  for (const [subPathKey, text] of Object.entries(STEP5_WHAT_WE_FIX)) {
    const shortCode = SUB_PATH_SHORT[subPathKey];
    const narration = STEP5_HELPER_NARRATION[subPathKey] || '';
    const name = `What we fix first \u2014 ${shortCode}: ${subPathKey.replace(/:.*/, '')}`;

    try {
      const result = await createQuestion({
        type: 'control_dropdown',
        text: name,
        required: 'No',
        sublabel: narration,
        options: text, // Single option = locked
        special: 'None',
      });

      const qid = typeof result === 'object' ? Object.keys(result)[0] : result;
      createdFields[subPathKey] = qid;
      console.log(`  Created: ${name} -> qid ${qid}`);
    } catch (err) {
      console.error(`  FAILED: ${name} -> ${err.message}`);
      createdFields[subPathKey] = null;
    }

    await sleep(500);
  }

  return createdFields;
}

// ---------------------------------------------------------------------------
// Step 2: Update sublabels on shared owner/due fields
// ---------------------------------------------------------------------------

async function updateSharedFieldSublabels() {
  console.log('\n=== Step 2: Updating shared owner/due field sublabels ===\n');

  const defaultOwnerHints = [
    'Default: see action description for suggested owner',
    'Default: see action description for suggested owner',
    'Default: see action description for suggested owner',
    'Default: see action description for suggested owner',
    'Default: see action description for suggested owner',
    'Default: see action description for suggested owner',
  ];

  const defaultDueHints = [
    'Default: Day 7',
    'Default: Day 7',
    'Default: Day 21',
    'Default: Day 21',
    'Default: Day 45',
    'Default: Day 45',
  ];

  for (let i = 0; i < 6; i++) {
    try {
      await updateQuestion(OWNER_QIDS[i], { sublabel: defaultOwnerHints[i] });
      console.log(`  Updated owner field q${OWNER_QIDS[i]} sublabel`);
    } catch (err) {
      console.error(`  FAILED owner q${OWNER_QIDS[i]}: ${err.message}`);
    }
    await sleep(300);

    try {
      await updateQuestion(DUE_QIDS[i], { sublabel: defaultDueHints[i] });
      console.log(`  Updated due field q${DUE_QIDS[i]} sublabel`);
    } catch (err) {
      console.error(`  FAILED due q${DUE_QIDS[i]}: ${err.message}`);
    }
    await sleep(300);
  }
}

// ---------------------------------------------------------------------------
// Step 3: Hide old shared description fields
// ---------------------------------------------------------------------------

async function hideOldFields() {
  console.log('\n=== Step 3: Hiding old free-text fields ===\n');

  const allOldQids = [...OLD_DESC_QIDS, OLD_WHAT_WE_FIX_QID];

  for (const qid of allOldQids) {
    try {
      await updateQuestion(qid, { hidden: 'Yes' });
      console.log(`  Hidden: q${qid}`);
    } catch (err) {
      console.error(`  FAILED to hide q${qid}: ${err.message}`);
    }
    await sleep(300);
  }
}

// ---------------------------------------------------------------------------
// Step 4: Set conditional logic
// ---------------------------------------------------------------------------

async function setConditionalLogic(actionFields, whatWeFixFields) {
  console.log('\n=== Step 4: Setting conditional logic ===\n');

  // Collect all new QIDs for hide-all logic (actions + "what we fix first")
  const allNewQids = [];
  for (const qids of Object.values(actionFields)) {
    allNewQids.push(...qids.filter(Boolean));
  }
  const allWhatWeFixQids = Object.values(whatWeFixFields).filter(Boolean);
  allNewQids.push(...allWhatWeFixQids);

  try {
    // Get existing conditions
    const props = await getFormProperties();
    let existingConditions = [];
    try {
      existingConditions = JSON.parse(props.conditions || '[]');
    } catch {
      existingConditions = props.conditions || [];
    }
    console.log(`  Found ${existingConditions.length} existing conditions`);

    // Build new conditions: for each sub-path, show its 6 fields and hide all others
    const newConditions = [];

    for (const [subPathKey, qids] of Object.entries(actionFields)) {
      const actionQids = qids.filter(Boolean);
      const whatWeFixQid = whatWeFixFields[subPathKey];
      const showQids = [...actionQids, ...(whatWeFixQid ? [whatWeFixQid] : [])];
      if (showQids.length === 0) continue;

      const pillar = SUB_PATH_PILLAR[subPathKey];
      const subPathFieldId = SUB_PATH_FIELDS[pillar];
      const subPathValue = jotformSubPathValue(subPathKey);

      // QIDs to hide = all new QIDs except this sub-path's
      const hideQids = allNewQids.filter(q => !showQids.includes(q));

      newConditions.push({
        type: 'field',
        link: 'Any',
        terms: JSON.stringify([
          { field: subPathFieldId, operator: 'equals', value: subPathValue },
        ]),
        action: JSON.stringify([
          { visibility: 'ShowMultiple', fields: showQids },
          ...(hideQids.length > 0 ? [{ visibility: 'HideMultiple', fields: hideQids }] : []),
        ]),
      });
    }

    // Combine existing + new conditions
    const allConditions = [...existingConditions, ...newConditions];
    console.log(`  Adding ${newConditions.length} new conditions (total: ${allConditions.length})`);

    const body = 'properties[conditions]=' + encodeURIComponent(JSON.stringify(allConditions));
    await setFormProperties(body);
    console.log('  Conditional logic updated successfully');

  } catch (err) {
    console.error(`  FAILED to set conditions: ${err.message}`);
    console.log('\n  === MANUAL FALLBACK ===');
    console.log('  Set conditions manually in JotForm form builder:');
    for (const [subPathKey, qids] of Object.entries(actionFields)) {
      const validQids = [...qids.filter(Boolean), whatWeFixFields[subPathKey]].filter(Boolean);
      if (validQids.length === 0) continue;
      const pillar = SUB_PATH_PILLAR[subPathKey];
      const subPathValue = jotformSubPathValue(subPathKey);
      console.log(`  When ${pillar} sub-path = "${subPathValue}" -> Show fields: ${validQids.join(', ')}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('JotForm Scan Worksheet — Predetermined Actions Setup');
  console.log(`Form ID: ${FORM_ID}`);
  console.log(`API endpoint: ${BASE_URL}`);

  // Step 1a: Create 84 locked action dropdown fields
  const actionFields = await createLockedDropdowns();

  // Step 1b: Create 14 locked "What we fix first" dropdown fields
  const whatWeFixFields = await createWhatWeFixDropdowns();

  // Step 2: Update sublabels on shared owner/due fields
  await updateSharedFieldSublabels();

  // Step 3: Hide old free-text fields (desc q41-q56 + opener q39)
  await hideOldFields();

  // Step 4: Set conditional logic (actions + what we fix first)
  await setConditionalLogic(actionFields, whatWeFixFields);

  // Summary
  console.log('\n=== Summary ===');
  let actionTotal = 0;
  for (const [key, qids] of Object.entries(actionFields)) {
    const created = qids.filter(Boolean).length;
    actionTotal += created;
    const wwfQid = whatWeFixFields[key] || 'FAILED';
    console.log(`  ${SUB_PATH_SHORT[key]}: ${key} -> ${created}/6 actions + wwf:${wwfQid}`);
  }
  const wwfTotal = Object.values(whatWeFixFields).filter(Boolean).length;
  console.log(`\n  Action fields created: ${actionTotal}/84`);
  console.log(`  "What we fix first" fields created: ${wwfTotal}/14`);
  console.log('\nDone. Verify in JotForm form preview.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
