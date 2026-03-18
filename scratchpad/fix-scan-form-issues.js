#!/usr/bin/env node
/**
 * Fix scan worksheet form issues from Marc's QA feedback.
 *
 * Usage: JOTFORM_API_KEY=<key> node scratchpad/fix-scan-form-issues.js
 *
 * Changes:
 *   1. q9  — Add helper text: "Defaulted from quiz — change only if needed."
 *   2. q25 — Add "Automated attendant / auto-answer" option
 *   3. q96 — Remove "secondary" from Action 2 text
 *   4. Disable participant auto-email (defaultAutoResponderEmailAssigned)
 */

const API_KEY = process.env.JOTFORM_API_KEY;
if (!API_KEY) {
  console.error('Error: set JOTFORM_API_KEY env var');
  process.exit(1);
}

const FORM_ID = '260435948553162';
const BASE = 'https://eu-api.jotform.com';

async function updateQuestion(qid, params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value);
  }

  const res = await fetch(`${BASE}/form/${FORM_ID}/question/${qid}?apiKey=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json();
  if (json.responseCode !== 200) {
    throw new Error(`q${qid} update failed: ${json.message}`);
  }
  return json;
}

async function updateProperties(params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value);
  }

  const res = await fetch(`${BASE}/form/${FORM_ID}/properties?apiKey=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json();
  if (json.responseCode !== 200) {
    throw new Error(`Properties update failed: ${json.message}`);
  }
  return json;
}

async function main() {
  console.log('=== Fixing scan worksheet form issues ===\n');

  // 1. q9 — Add helper description
  console.log('1. Updating q9 (Confirmed Primary Gap) — adding helper text...');
  await updateQuestion(9, {
    'question[description]': 'Defaulted from quiz — change only if needed.',
  });
  console.log('   ✓ Done\n');

  // 2. q25 — Add "Automated attendant / auto-answer" option
  console.log('2. Updating q25 (Calls answered live) — adding auto-answer option...');
  await updateQuestion(25, {
    'question[options]': 'Always|Often|Sometimes|Rarely|Automated attendant / auto-answer|Not sure|Not applicable',
  });
  console.log('   ✓ Done\n');

  // 3. q96 — Remove "secondary" from Action 2 text
  console.log('3. Updating q96 (A1 Action 2) — removing "secondary"...');
  await updateQuestion(96, {
    'question[options]': 'Choose ONE warm channel to add.',
  });
  console.log('   ✓ Done\n');

  // 4. Disable participant auto-email
  console.log('4. Disabling participant auto-email...');
  await updateProperties({
    'properties[defaultAutoResponderEmailAssigned]': 'No',
  });
  console.log('   ✓ Done\n');

  // Verify
  console.log('=== Verifying changes ===\n');

  const verify = async (qid, label) => {
    const res = await fetch(`${BASE}/form/${FORM_ID}/question/${qid}?apiKey=${API_KEY}`);
    const json = await res.json();
    const c = json.content;
    console.log(`q${qid} (${label}):`);
    if (c.options) console.log(`  options: ${c.options}`);
    if (c.description) console.log(`  description: ${c.description}`);
    console.log('');
  };

  await verify(9, 'Confirmed Primary Gap');
  await verify(25, 'Calls answered live');
  await verify(96, 'A1 Action 2');

  const propRes = await fetch(`${BASE}/form/${FORM_ID}/properties?apiKey=${API_KEY}`);
  const propJson = await propRes.json();
  console.log('defaultAutoResponderEmailAssigned:', propJson.content.defaultAutoResponderEmailAssigned);

  console.log('\n=== All fixes applied ===');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
