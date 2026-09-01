/**
 * TwoFactorService — real TOTP-based 2FA, the actual security gap
 * confirmed absent (checked via grep, not assumed) before this was
 * built. Standard, well-established libraries (otplib, qrcode) rather
 * than a hand-rolled implementation of a cryptographic protocol — TOTP's
 * correctness depends on exact RFC 6238 conformance (time-step windows,
 * HMAC construction), and reimplementing that from scratch is exactly
 * the kind of thing that's easy to get subtly, dangerously wrong.
 */
const { generateSecret, generate, verify, generateURI } = require('otplib');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');

const BACKUP_CODE_COUNT = 10;

/** Starts setup: generates a real secret and a scannable QR code, but does NOT enable 2FA yet. Calling this again before confirmSetup() simply overwrites the pending secret, which is correct: an abandoned setup shouldn't linger as a stale, never-confirmed secret. */
async function setup(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');
  if (user.twoFactorEnabled) throw new Error('2FA is already enabled, disable it first before setting up again.');

  const secret = generateSecret();
  user.twoFactorSecret = secret;
  await user.save();

  const otpauthUrl = generateURI({ secret, label: user.email, issuer: 'Muhasib POS/ERP' });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, otpauthUrl, qrCodeDataUrl };
}

/** Generates real, single-use backup codes, hashed at rest, returned in PLAIN form exactly once, the same "shown once, never retrievable again" principle a real API-key generation flow uses. */
function generateBackupCodes() {
  const plainCodes = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    plainCodes.push(crypto.randomBytes(5).toString('hex').toUpperCase()); // 10-char codes, e.g. "A1B2C3D4E5"
  }
  return plainCodes;
}

/** Confirms setup: the user must prove they can actually generate a valid code from what they scanned before 2FA becomes active. Also issues backup codes at this exact moment, since this is the one point where we know the user genuinely has working access to their authenticator. */
async function confirmSetup(userId, token) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');
  if (!user.twoFactorSecret) throw new Error('No pending 2FA setup found: call setup() first.');

  const result = await verify({ token, secret: user.twoFactorSecret });
  if (!result.valid) throw new Error('Invalid verification code: check your authenticator app and try again.');

  const plainBackupCodes = generateBackupCodes();
  const hashedCodes = await Promise.all(plainBackupCodes.map((code) => bcrypt.hash(code, 10)));

  user.twoFactorEnabled = true;
  user.twoFactorBackupCodeHashes = hashedCodes;
  await user.save();

  return { backupCodes: plainBackupCodes }; // the only time these plain codes are ever returned — store them now, they can't be retrieved again
}

/**
 * Verifies a login-time code — either a real TOTP token, OR one of the
 * remaining backup codes. A matched backup code is CONSUMED (removed
 * from the array) so it can never be reused, the same single-use
 * principle a refresh token's rotation already establishes elsewhere in
 * this app. Backup codes are checked by iterating and bcrypt.compare-ing
 * each hash — they can't be looked up by exact value since they're
 * hashed, same reasoning passwordHash already requires.
 */
async function verifyLoginCode(userId, token) {
  const user = await User.findById(userId);
  if (!user || !user.twoFactorEnabled) throw new Error('2FA is not enabled for this account.');

  // otplib's verify() throws TokenLengthError (rather than returning
  // { valid: false }) for anything that isn't a well-formed 6-digit TOTP
  // token — and a backup code is a 10-char hex string, not a TOTP token.
  // Without this guard, submitting a backup code here would crash the
  // request before it ever reached the backup-code check below, instead
  // of falling through to it as intended.
  let totpValid = false;
  try {
    const totpResult = await verify({ token, secret: user.twoFactorSecret });
    totpValid = totpResult.valid;
  } catch (err) {
    totpValid = false; // malformed/wrong-shape token — not a valid TOTP code, try backup codes instead
  }
  if (totpValid) return { verified: true, usedBackupCode: false };

  for (let i = 0; i < user.twoFactorBackupCodeHashes.length; i++) {
    if (await bcrypt.compare(token, user.twoFactorBackupCodeHashes[i])) {
      user.twoFactorBackupCodeHashes.splice(i, 1); // single-use — consumed the moment it's matched
      await user.save();
      return { verified: true, usedBackupCode: true, remainingBackupCodes: user.twoFactorBackupCodeHashes.length };
    }
  }

  return { verified: false };
}

/** Disabling 2FA requires re-proving the password, a real security requirement; without this, anyone with a stolen, already-logged-in session could silently strip 2FA off an account. */
async function disable(userId, password) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');
  if (!(await user.checkPassword(password))) throw new Error('Incorrect password.');

  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;
  user.twoFactorBackupCodeHashes = [];
  await user.save();
  return { disabled: true };
}

module.exports = { setup, confirmSetup, verifyLoginCode, disable };
