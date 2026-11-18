/**
 * clevertap.js
 * Wrapper around the CleverTap Upload API.
 * Docs: https://developer.clevertap.com/docs/upload-user-profiles-and-events
 */

const fetch = require('node-fetch');

const CLEVERTAP_API_URL = 'https://api.clevertap.com/1/upload';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the headers object required by CleverTap's Upload API.
 */
function buildHeaders(accountId, passcode) {
  return {
    'Content-Type': 'application/json',
    'X-CleverTap-Account-Id': accountId,
    'X-CleverTap-Passcode': passcode,
  };
}

/**
 * Constructs a single CleverTap event payload record.
 *
 * @param {string} identity  - Unique user identifier (email, phone, or custom).
 * @param {string} eventName - Name of the event as it should appear in CleverTap.
 * @param {object} eventData - Key-value pairs of event properties.
 * @returns {object} CleverTap event record.
 */
function buildEventRecord(identity, eventName, eventData) {
  return {
    identity: identity || 'anonymous',
    type: 'event',
    evtName: eventName,
    evtData: {
      ...eventData,
      // Always include a server-side timestamp so data is reliable
      ct_server_ts: Math.floor(Date.now() / 1000),
    },
  };
}

/**
 * Sends a request to CleverTap's Upload API and handles the response.
 *
 * @param {string}   accountId - CleverTap Account ID.
 * @param {string}   passcode  - CleverTap Passcode.
 * @param {object[]} records   - Array of CleverTap record objects.
 * @returns {Promise<object>}  - Parsed CleverTap API response.
 */
async function callCleverTapApi(accountId, passcode, records) {
  const payload = { d: records };

  console.log(`[CleverTap] Uploading ${records.length} record(s) to ${CLEVERTAP_API_URL}`);

  const response = await fetch(CLEVERTAP_API_URL, {
    method: 'POST',
    headers: buildHeaders(accountId, passcode),
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  // CleverTap sometimes returns non-JSON on auth errors
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `CleverTap API responded with ${response.status}: ${JSON.stringify(data)}`
    );
  }

  // CleverTap returns { status: "success", processed: N } on success
  if (data.status && data.status !== 'success') {
    throw new Error(`CleverTap upload failed: ${JSON.stringify(data)}`);
  }

  return data;
}

// ─── Exported Functions ───────────────────────────────────────────────────────

/**
 * Sends a single event to CleverTap.
 *
 * @param {object} opts
 * @param {string} opts.accountId
 * @param {string} opts.passcode
 * @param {string} opts.identity
 * @param {string} opts.eventName
 * @param {object} [opts.eventData]
 */
async function sendEvent({ accountId, passcode, identity, eventName, eventData = {} }) {
  const record = buildEventRecord(identity, eventName, eventData);
  return callCleverTapApi(accountId, passcode, [record]);
}

/**
 * Sends a batch of events to CleverTap in a single API call.
 * CleverTap allows up to 200 records per request.
 *
 * @param {object}   opts
 * @param {string}   opts.accountId
 * @param {string}   opts.passcode
 * @param {object[]} opts.events  - Array of { identity, eventName, eventData }
 */
async function sendBatchEvents({ accountId, passcode, events }) {
  if (events.length > 200) {
    throw new Error('CleverTap allows a maximum of 200 records per upload request.');
  }

  const records = events.map(({ identity, eventName, eventData }) =>
    buildEventRecord(identity, eventName, eventData || {})
  );

  return callCleverTapApi(accountId, passcode, records);
}

/**
 * Validates CleverTap credentials by sending a test "Integration Verified"
 * event. Returns { valid: true } on success, throws on failure.
 */
async function validateCredentials(accountId, passcode) {
  const record = buildEventRecord('ct_validation_probe', 'Integration Verified', {
    source: 'CleverTap Integration Tool',
  });

  const result = await callCleverTapApi(accountId, passcode, [record]);
  return { valid: true, result };
}

module.exports = { sendEvent, sendBatchEvents, validateCredentials };
