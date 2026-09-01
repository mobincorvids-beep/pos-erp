const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');

/**
 * The full set of scopes an API key can be granted. Small and deliberately
 * limited to the core entities a machine integration realistically needs
 * (Products, Sales, Customers, Inventory) — not a mirror of every
 * requirePermission() key in the app. Extend this list as the public API
 * surface grows past the example routes in publicApiRoutes.js.
 */
const AVAILABLE_SCOPES = [
  'products:read', 'products:write',
  'sales:read', 'sales:write',
  'customers:read', 'customers:write',
  'inventory:read', 'inventory:write',
];

function generateRawKey() {
  // Prefixed so a leaked key is recognizable at a glance (same idea as
  // Stripe's sk_live_ / GitHub's ghp_ conventions) — 32 random bytes is
  // 256 bits of entropy, far beyond brute-forceable.
  return `pk_${crypto.randomBytes(32).toString('hex')}`;
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Creates a new API key for a company. The raw secret is returned ONLY in
 * this response — it is never stored (only its hash) and can never be
 * retrieved again after this call returns. Callers (the controller) must
 * make sure the UI makes that permanence unmistakable.
 */
async function createApiKey(companyId, { name, scopes = [], userId }) {
  if (!name || !name.trim()) throw new Error('An API key needs a name.');
  const invalidScopes = scopes.filter((s) => !AVAILABLE_SCOPES.includes(s));
  if (invalidScopes.length) throw new Error(`Unknown scope(s): ${invalidScopes.join(', ')}`);

  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 11); // "pk_" + first 8 hex chars — enough to tell keys apart in the UI, not enough to be useful to an attacker

  const apiKey = await ApiKey.create({
    companyId, name: name.trim(), keyPrefix, keyHash, scopes, createdByUserId: userId || null,
  });

  return {
    id: apiKey._id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    scopes: apiKey.scopes,
    createdAt: apiKey.createdAt,
    rawKey, // shown once — the caller must not persist or log this anywhere else
  };
}

/** Never returns the raw key or the hash, listing is safe to hand straight to the client. */
async function listApiKeys(companyId) {
  const keys = await ApiKey.find({ companyId }).sort({ createdAt: -1 }).select('name keyPrefix scopes lastUsedAt revokedAt expiresAt createdAt');
  return keys.map((k) => ({
    id: k._id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt,
    revokedAt: k.revokedAt,
    expiresAt: k.expiresAt,
    createdAt: k.createdAt,
  }));
}

async function revokeApiKey(companyId, apiKeyId) {
  const apiKey = await ApiKey.findOne({ _id: apiKeyId, companyId });
  if (!apiKey) throw new Error('API key not found.');
  if (apiKey.revokedAt) return apiKey; // already revoked — idempotent
  apiKey.revokedAt = new Date();
  await apiKey.save();
  return apiKey;
}

/**
 * Small helper for apiKeyAuth-protected route handlers to check the
 * presenting key was granted a given scope. Mirrors requirePermission()'s
 * shape in middleware/auth.js but works off req.apiKeyScopes rather than
 * req.auth.permissions — a genuinely separate authorization axis since API
 * keys are never assigned a Role.
 *
 * Usage: router.get('/products', apiKeyAuth, requireScope('products:read'), controller.list)
 */
function requireScope(scope) {
  return (req, res, next) => {
    const scopes = req.apiKeyScopes || [];
    if (!scopes.includes(scope)) {
      return res.status(403).json({ error: `This API key is missing the required scope: ${scope}` });
    }
    next();
  };
}

module.exports = { AVAILABLE_SCOPES, createApiKey, listApiKeys, revokeApiKey, requireScope };
