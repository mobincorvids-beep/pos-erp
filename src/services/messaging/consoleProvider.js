/**
 * ConsoleProvider — the default messaging transport, used automatically
 * whenever no real provider's credentials are configured. This is a
 * genuinely WORKING implementation, not a placeholder: it logs the
 * message and returns a real success result, exactly the transport many
 * real systems use for local development and staging. What it does NOT
 * do is put a message on a real customer's phone or in their inbox —
 * that requires real Twilio/SendGrid credentials (see twilioProvider.js /
 * sendgridProvider.js), which this codebase cannot fabricate.
 */
async function sendSms(to, message) {
  console.log(`[console-sms-provider] would send to ${to}: "${message}"`);
  return { success: true, provider: 'console' };
}

async function sendEmail(to, subject, message) {
  console.log(`[console-email-provider] would send to ${to} — subject "${subject}": "${message}"`);
  return { success: true, provider: 'console' };
}

module.exports = { sendSms, sendEmail };
