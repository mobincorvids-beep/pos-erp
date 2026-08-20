/**
 * RefreshTokenService — issues, rotates, and revokes refresh tokens for
 * BOTH auth namespaces (tenant User and PlatformAdmin — see
 * middleware/auth.js and middleware/platformAuth.js for why those stay
 * separate everywhere else). Shared here because the token mechanics
 * (hash, expire, rotate-on-use, detect reuse) are identical regardless of
 * which kind of account it belongs to — only the JWT payload the caller
 * builds on top differs.
 *
 * Rotation: every refresh consumes the token and issues a new one
 * (single-use). If a refresh token is presented that's already been
 * rotated away (replacedByTokenHash is set) or revoked, ALL of that
 * subject's tokens are revoked — that pattern only happens if a token was
 * stolen and used by two parties, so the safe response is to force
 * everyone back to a fresh login.
 */
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

const REFRESH_TOKEN_DAYS = 30;

function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(48).toString('hex');
}

/** @returns {Promise<string>} the raw refresh token — only ever returned once, never stored in plaintext. */
async function issue(subjectType, subjectId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ subjectType, subjectId, tokenHash: hash(token), expiresAt });
  return token;
}

/**
 * Validates and rotates a refresh token.
 * @returns {Promise<{ subjectType: string, subjectId: string, newToken: string }>}
 * @throws if the token is invalid, expired, revoked, or already rotated (and revokes the whole family in that last case).
 */
async function rotate(rawToken) {
  const tokenHash = hash(rawToken);
  const record = await RefreshToken.findOne({ tokenHash });

  if (!record) throw new Error('Invalid refresh token.');

  if (record.revokedAt || record.replacedByTokenHash) {
    // Reuse of a token that's already been rotated or revoked — possible
    // theft. Revoke every other live token for this subject as a precaution.
    await RefreshToken.updateMany(
      { subjectType: record.subjectType, subjectId: record.subjectId, revokedAt: null },
      { revokedAt: new Date() }
    );
    throw new Error('This refresh token has already been used or revoked. All sessions for this account have been signed out as a precaution — please log in again.');
  }

  if (record.expiresAt < new Date()) throw new Error('Refresh token has expired — please log in again.');

  const newToken = generateToken();
  const newHash = hash(newToken);
  await RefreshToken.create({ subjectType: record.subjectType, subjectId: record.subjectId, tokenHash: newHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000) });

  record.replacedByTokenHash = newHash;
  await record.save();

  return { subjectType: record.subjectType, subjectId: record.subjectId, newToken };
}

/** Revokes one refresh token — call on logout. */
async function revoke(rawToken) {
  await RefreshToken.updateOne({ tokenHash: hash(rawToken) }, { revokedAt: new Date() });
}

/** Revokes every live token for a subject — e.g. when suspending a user/admin. */
async function revokeAllForSubject(subjectType, subjectId) {
  await RefreshToken.updateMany(
    { subjectType, subjectId, revokedAt: null },
    { revokedAt: new Date() }
  );
}

module.exports = { issue, rotate, revoke, revokeAllForSubject };
