#!/usr/bin/env node
/**
 * MindtheGaps — Calendly Webhook Subscription Setup
 *
 * Creates a webhook subscription via the Calendly API so that
 * invitee.created events are sent to the mtg-calendly-webhook worker.
 *
 * Usage:
 *   CALENDLY_API_TOKEN=your_token WEBHOOK_URL=https://mtg-calendly-webhook.xxx.workers.dev node scripts/setup-calendly-webhook.js
 *
 * Requires: Node 18+ (uses native fetch)
 */

const CALENDLY_API = 'https://api.calendly.com';

async function main() {
  const token = process.env.CALENDLY_API_TOKEN;
  const webhookUrl = process.env.WEBHOOK_URL;

  if (!token) {
    console.error('Error: CALENDLY_API_TOKEN environment variable is required.');
    console.error('Usage: CALENDLY_API_TOKEN=your_token WEBHOOK_URL=https://your-worker.workers.dev node scripts/setup-calendly-webhook.js');
    process.exit(1);
  }

  if (!webhookUrl) {
    console.error('Error: WEBHOOK_URL environment variable is required.');
    console.error('This should be your deployed Calendly webhook worker URL.');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Step 1: Get current user to find the organization URI
  console.log('\nStep 1: Getting current user info...');
  const meRes = await fetch(`${CALENDLY_API}/users/me`, { headers });

  if (!meRes.ok) {
    const err = await meRes.text();
    console.error(`Failed to get user info: ${meRes.status} ${err}`);
    process.exit(1);
  }

  const meData = await meRes.json();
  const orgUri = meData.resource.current_organization;
  const userUri = meData.resource.uri;
  console.log(`  Organization: ${orgUri}`);
  console.log(`  User: ${meData.resource.name} (${meData.resource.email})`);

  // Step 2: Check for existing webhook subscriptions
  console.log('\nStep 2: Checking existing webhook subscriptions...');
  const listRes = await fetch(
    `${CALENDLY_API}/webhook_subscriptions?organization=${encodeURIComponent(orgUri)}&scope=organization`,
    { headers },
  );

  if (listRes.ok) {
    const listData = await listRes.json();
    const existing = listData.collection || [];

    for (const sub of existing) {
      if (sub.callback_url === webhookUrl) {
        console.log(`  Webhook already exists for ${webhookUrl}`);
        console.log(`  State: ${sub.state}`);
        console.log(`  Events: ${sub.events.join(', ')}`);
        console.log(`  URI: ${sub.uri}`);
        console.log('\nNo action needed — webhook subscription already exists.');
        return;
      }
    }
    console.log(`  Found ${existing.length} existing subscription(s), none match our URL.`);
  }

  // Step 3: Create webhook subscription
  console.log('\nStep 3: Creating webhook subscription...');
  const createRes = await fetch(`${CALENDLY_API}/webhook_subscriptions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: webhookUrl,
      events: ['invitee.created'],
      organization: orgUri,
      user: userUri,
      scope: 'organization',
      signing_key: undefined, // Calendly generates one for us
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error(`Failed to create webhook: ${createRes.status} ${err}`);
    process.exit(1);
  }

  const createData = await createRes.json();
  const sub = createData.resource;

  console.log('\n  Webhook subscription created successfully!');
  console.log(`  URL: ${sub.callback_url}`);
  console.log(`  Events: ${sub.events.join(', ')}`);
  console.log(`  State: ${sub.state}`);
  console.log(`  URI: ${sub.uri}`);

  // Note about signing key
  console.log('\n--- IMPORTANT ---');
  console.log('Calendly generates a signing key for webhook verification.');
  console.log('To get the signing key, check the webhook subscription details in the Calendly API:');
  console.log(`  GET ${sub.uri}`);
  console.log('Then set it as CALENDLY_WEBHOOK_SECRET on your worker:');
  console.log('  wrangler secret put CALENDLY_WEBHOOK_SECRET');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
