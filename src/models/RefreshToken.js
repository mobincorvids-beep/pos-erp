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
}, { timestamps: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL index — expired tokens clean themselves up

module.exports = model('RefreshToken', refreshTokenSchema);
