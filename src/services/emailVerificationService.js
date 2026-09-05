/**
 * EmailVerificationService — proves a signup's email address is real and
 * actually owned by the person signing up, via a 6-digit one-time code
 * mailed to them. Separate from twoFactorService's TOTP 2FA (that's an
 * opt-in, ongoing per-login second factor; this is a one-time signup
 * gate). Codes are cryptographically random (crypto.randomInt, not
 * Math.random), stored only as a bcrypt hash (never plaintext, same
 * principle as User.passwordHash), and expire quickly.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const emailService = require('../services/emailService');

const OTP_TTL_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 60;

function generateOtp() {
  // 6-digit, zero-padded, uniformly random (crypto.randomInt is rejection-
  // sampled under the hood — no modulo bias the way Math.random() % 10
  // would have).
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/** Generates a fresh OTP for `user`, stores its hash, and emails it. Throws if called again inside the resend cooldown. */
async function sendVerificationCode(user) {
  if (user.emailOtpLastSentAt) {
    const secondsSinceLast = (Date.now() - user.emailOtpLastSentAt.getTime()) / 1000;
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      throw new Error(`Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)} seconds before requesting another code.`);
    }
  }

  const code = generateOtp();
  user.emailOtpHash = await bcrypt.hash(code, 10);
  user.emailOtpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  user.emailOtpLastSentAt = new Date();
  await user.save();

  const { delivered } = await emailService.send({
    to: user.email,
    subject: 'Your ZAM ERP verification code',
    html: `
      <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #17352F;">Verify your email</h2>
        <p>Hi ${user.name || ''},</p>
        <p>Use this code to finish creating your ZAM ERP account. It expires in ${OTP_TTL_MINUTES} minutes.</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; background: #F5F4F1; padding: 16px 24px; border-radius: 8px; text-align: center;">${code}</p>
        <p style="color: #6B7280; font-size: 13px;">If you didn't request this, you can safely ignore this email — nobody can access your account without this code.</p>
      </div>
    `,
  });

  return { delivered, expiresInMinutes: OTP_TTL_MINUTES };
}

/**
 * Checks `code` against the stored hash for `user`. On success, marks the
 * user verified and clears the OTP fields (single-use — a spent or
 * expired code can never be replayed). Throws with a specific, honest
 * reason on failure; callers should NOT reveal further detail than that
 * to the client (no "expired" vs "wrong" distinction leaked beyond the
 * message text itself, which is fine here since this endpoint is already
 * scoped to one specific pending signup via a short-lived token, not
 * guessable by an attacker who doesn't already have that token).
 */
async function verifyCode(user, code) {
  if (user.emailVerified) return; // already verified — idempotent, not an error
  if (!user.emailOtpHash || !user.emailOtpExpiresAt) {
    throw new Error('No verification code is pending for this account. Request a new one.');
  }
  if (user.emailOtpExpiresAt.getTime() < Date.now()) {
    throw new Error('This code has expired. Request a new one.');
  }
  const match = await bcrypt.compare(String(code), user.emailOtpHash);
  if (!match) {
    throw new Error('Incorrect code.');
  }

  user.emailVerified = true;
  user.emailOtpHash = null;
  user.emailOtpExpiresAt = null;
  await user.save();
}

module.exports = { sendVerificationCode, verifyCode, OTP_TTL_MINUTES };
