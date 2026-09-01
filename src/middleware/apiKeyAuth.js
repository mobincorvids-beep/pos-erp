const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');

/**
 * Auth for the public Developer Platform API (src/routes/publicApiRoutes.js)
 * — a genuinely separate scheme from requireAuth (tenant JWT, for staff in
 * the app) and requireWebhookToken (single fixed token per company for the
 * e-commerce integration, middleware/ecommerceAuth.js). An ApiKey is a
 * per-integration, individually-revocable, scoped credential a company can
 * issue many of.
 *
 * Reads the raw key from `Authorization: Bearer <key>` (preferred, same
 * header shape as requireAuth) or `X-Api-Key` (convenience for clients that
 * can't easily set a custom Bearer scheme). The raw key is never stored —
 * only its sha256 hash — so lookup is by hash, not by decrypting anything.
 *
 * On success attaches:
 *   req.companyId    - same shape requireAuth + scopeToCompany produce, so
 *                       downstream controllers/services need no branching
 *   req.apiKeyScopes - array of scope strings this key was granted
 *   req.apiKeyId     - the ApiKey document's _id (for lastUsedAt bookkeeping done here)
 */
async function apiKeyAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const rawKey = bearer || req.headers['x-api-key'];

    if (!rawKey) return res.status(401).json({ error: 'Missing API key. Send it as "Authorization: Bearer <key>" or "X-Api-Key".' });

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await ApiKey.findOne({ keyHash });

    if (!apiKey) return res.status(401).json({ error: 'Invalid API key.' });
    if (apiKey.revokedAt) return res.status(401).json({ error: 'This API key has been revoked.' });
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return res.status(401).json({ error: 'This API key has expired.' });

    // Fire-and-forget bookkeeping — a failure here should never block the
    // actual request the key was presented for.
    ApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date() } }).catch((err) => {
      console.error('apiKeyAuth: failed to update lastUsedAt', err);
    });

    req.companyId = apiKey.companyId;
    req.apiKeyScopes = apiKey.scopes || [];
    req.apiKeyId = apiKey._id;
    next();
  } catch (err) {
    console.error('apiKeyAuth error', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { apiKeyAuth };
