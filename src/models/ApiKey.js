const { Schema, model } = require('mongoose');

/**
 * A machine-client credential for the Developer Platform (see
 * src/middleware/apiKeyAuth.js and src/services/apiKeyService.js).
 * Separate concept from Company.ecommerceConfig.webhookToken (one token per
 * company, fixed purpose) — an ApiKey is scoped, named, individually
 * revocable, and a company can hold many of them.
 *
 * The raw secret itself is NEVER stored — only its sha256 hash (keyHash),
 * looked up directly on each request. keyPrefix is a short, non-secret
 * slice of the raw key shown in the UI so a user can tell keys apart
 * without ever seeing the secret again after creation.
 */
const apiKeySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // user-chosen label, e.g. "Warehouse sync bot"
  keyPrefix: { type: String, required: true, index: true }, // first 8 chars of the raw key, shown in UI
  keyHash: { type: String, required: true, unique: true }, // sha256 hex digest of the raw key
  scopes: [{ type: String }], // e.g. ['products:read', 'sales:write']
  createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  lastUsedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null }, // optional; null = never expires
}, { timestamps: true });

apiKeySchema.index({ companyId: 1, revokedAt: 1 });

module.exports = model('ApiKey', apiKeySchema);
