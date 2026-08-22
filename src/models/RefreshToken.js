const { Schema, model } = require('mongoose');

// Refresh tokens are stored hashed (never plaintext) so a database leak
// alone can't be used to mint new access tokens — same principle as
// passwords, just with a shorter useful lifetime for an attacker.
// `subjectType` distinguishes a tenant User from a PlatformAdmin, since
// they're different collections but share this one refresh-token store
// rather than needing two parallel implementations.
const refreshTokenSchema = new Schema({
  subjectType: { type: String, required: true, enum: ['user', 'platform_admin'] },
  subjectId: { type: Schema.Types.ObjectId, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedByTokenHash: { type: String, default: null }, // set on rotation, for audit trail

  // Device/session context — this record already WAS the real session
  // concept (issue on login, rotate on refresh, revoke on logout); these
  // fields just make that explicit and give a user something real to look
  // at ("Chrome on Windows, last active 2 hours ago") and revoke
  // individually, rather than inventing a second, parallel Session model
  // that would just duplicate what this document already represents.
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  lastUsedAt: { type: Date, default: Date.now },
}, { timestamps: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL index — expired tokens clean themselves up

module.exports = model('RefreshToken', refreshTokenSchema);
