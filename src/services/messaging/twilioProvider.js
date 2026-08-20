/**
 * TwilioProvider — a real HTTP integration against Twilio's REST API
 * (documented, stable contract: POST to
 * https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json,
 * Basic Auth with AccountSid:AuthToken, form-encoded body). Only used when
 * TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER are all set — see
 * messagingService.js for the selection logic.
 *
 * Honesty check: this code is correct against Twilio's documented API
 * shape, but has never been executed against Twilio's real servers in this
 * sandbox (no real Twilio account exists here to test against, and
 * api.twilio.com isn't reachable from this environment's network
 * allowlist regardless). Verify it against a real Twilio trial account
 * before relying on it in production.
 */
async function sendSms(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({ To: to, From: fromNumber, Body: message });
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Twilio send failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return { success: true, provider: 'twilio', providerMessageId: data.sid };
}

module.exports = { sendSms };
