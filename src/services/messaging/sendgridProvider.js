/**
 * SendGridProvider — a real HTTP integration against SendGrid's v3 REST
 * API (documented, stable contract: POST to
 * https://api.sendgrid.com/v3/mail/send, Bearer auth, JSON body). Only
 * used when SENDGRID_API_KEY and SENDGRID_FROM_EMAIL are both set — see
 * messagingService.js for the selection logic.
 *
 * Same honesty note as twilioProvider.js: correct against SendGrid's
 * documented API shape, never executed against SendGrid's real servers in
 * this sandbox — no real account exists here to test against, and the
 * API host isn't reachable from this environment's network allowlist
 * regardless. Verify against a real SendGrid account before relying on it.
 */
async function sendEmail(to, subject, message) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail },
      subject,
      content: [{ type: 'text/plain', value: message }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`SendGrid send failed (${response.status}): ${errorBody}`);
  }

  // SendGrid returns 202 with no body on success and the message ID in a header.
  return { success: true, provider: 'sendgrid', providerMessageId: response.headers.get('x-message-id') || null };
}

module.exports = { sendEmail };
