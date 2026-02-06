/**
 * MindtheGaps — HubSpot API Client
 *
 * Thin wrapper around the HubSpot Contacts v3 API using fetch()
 * (available natively in Cloudflare Workers).
 *
 * Plug-and-play: all methods require an apiKey parameter.
 * In production the Worker passes env.HUBSPOT_API_KEY.
 *
 * Contact-only — no Deals, no pipeline (per project spec).
 * Deduplicates by email — always upserts, never creates duplicates.
 *
 * Public API:
 *   createHubSpotClient(apiKey)  → { upsertContact, getContactByEmail, updateContact }
 */

const BASE_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create a HubSpot Contacts API client bound to a specific API key.
 *
 * @param {string} apiKey - HubSpot private app API key
 * @returns {object} Client with upsertContact, getContactByEmail, updateContact
 */
function createHubSpotClient(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('createHubSpotClient requires a non-empty API key');
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // -----------------------------------------------------------------------
  // Search for a contact by email
  // -----------------------------------------------------------------------

  /**
   * Find a contact by email address.
   *
   * @param {string} email
   * @returns {Promise<object|null>} Contact object or null if not found
   */
  async function getContactByEmail(email) {
    const response = await fetch(`${BASE_URL}/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email,
              },
            ],
          },
        ],
        properties: ['email', 'firstname', 'lastname'],
        limit: 1,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HubSpot search failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    if (data.total === 0 || !data.results || data.results.length === 0) {
      return null;
    }

    return data.results[0];
  }

  // -----------------------------------------------------------------------
  // Create a new contact
  // -----------------------------------------------------------------------

  /**
   * @param {Record<string, string>} properties - HubSpot contact properties
   * @returns {Promise<object>} Created contact
   */
  async function createContact(properties) {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HubSpot create failed (${response.status}): ${body}`);
    }

    return response.json();
  }

  // -----------------------------------------------------------------------
  // Update an existing contact by ID
  // -----------------------------------------------------------------------

  /**
   * @param {string} contactId - HubSpot contact ID
   * @param {Record<string, string>} properties - Properties to update
   * @returns {Promise<object>} Updated contact
   */
  async function updateContact(contactId, properties) {
    const response = await fetch(`${BASE_URL}/${contactId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HubSpot update failed (${response.status}): ${body}`);
    }

    return response.json();
  }

  // -----------------------------------------------------------------------
  // Upsert: search by email → update if found, create if not
  // -----------------------------------------------------------------------

  /**
   * Create or update a contact by email. Never creates duplicates.
   *
   * @param {string} email - Contact email (used as dedupe key)
   * @param {Record<string, string>} properties - All properties to write
   * @returns {Promise<{ contact: object, created: boolean }>}
   */
  async function upsertContact(email, properties) {
    const existing = await getContactByEmail(email);

    if (existing) {
      const updated = await updateContact(existing.id, properties);
      return { contact: updated, created: false };
    }

    // Ensure email is in the properties for the create call
    const propsWithEmail = { ...properties, email };
    const created = await createContact(propsWithEmail);
    return { contact: created, created: true };
  }

  return {
    getContactByEmail,
    updateContact,
    upsertContact,
  };
}

module.exports = { createHubSpotClient };
