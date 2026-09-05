/**
 * EmailService — the single place that actually sends an email out of
 * this app, via nodemailer over plain SMTP. Deliberately provider-agnostic:
 * it works with a free Gmail account (App Password), a free-tier
 * transactional provider (Brevo/Sendinblue, Resend's SMTP endpoint, Mailgun,
 * etc.) or any other SMTP server — whatever SMTP_HOST/PORT/USER/PASS point
 * at. See .env.example for the exact free-Gmail setup steps.
 *
 * Same "safe to require even when unconfigured" pattern as
 * src/config/passport.js: if SMTP isn't configured, `enabled` is false and
 * send() logs the email to the console instead of throwing — so a fresh
 * clone/CI run never crashes on a missing mail server, it just can't
 * actually deliver mail (and callers like emailVerificationService make
 * that limitation visible to the user rather than silently pretending an
 * email went out).
 */
const nodemailer = require('nodemailer');

let transporter = null;
let enabled = false;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    // 465 is the implicit-TLS port; every other common port (587, 25) uses
    // STARTTLS instead — nodemailer needs to be told which, it can't infer
    // it from the port alone.
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  enabled = true;
} else if (process.env.NODE_ENV !== 'test') {
  console.log('ℹ Email sending is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS not set) — verification codes and notification emails will be logged to the console instead of delivered. See .env.example for free Gmail SMTP setup.');
}

/**
 * @param {Object} input
 * @param {String} input.to
 * @param {String} input.subject
 * @param {String} input.html
 * @param {String} [input.text] - falls back to a tag-stripped version of html
 * @returns {Promise<{delivered: Boolean}>}
 */
async function send({ to, subject, html, text }) {
  if (!enabled) {
    // Sandbox/CI/local-without-SMTP fallback — makes the code path
    // exercisable (and the OTP visible for manual testing) without a real
    // mail server, rather than throwing and blocking signup entirely.
    console.log(`ℹ [emailService] SMTP not configured — would have sent to ${to}: "${subject}"\n${text || html}`);
    return { delivered: false };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  });
  return { delivered: true };
}

module.exports = { send, enabled: () => enabled };
