const Company = require('../models/Company');

/**
 * Auth for the e-commerce integration endpoints — an external store has no
 * user session, so this is a separate scheme entirely from requireAuth
 * (tenant JWT) and requirePlatformAdmin: the company is identified by its
 * public slug in the URL, and the request proves it belongs to that company
 * with a webhook token (like a Shopify/Stripe webhook secret), not a
 * bearer JWT. Attaches req.company and req.companyId on success.
 */
async function requireWebhookToken(req, res, next) {
  const { slug } = req.params;
  const token = req.headers['x-webhook-token'];

  if (!token) return res.status(401).json({ error: 'Missing X-Webhook-Token header.' });

  const company = await Company.findOne({ slug });
  if (!company) return res.status(404).json({ error: 'Store not found.' });
  if (!company.isActive) return res.status(403).json({ error: 'This store is not currently active.' });
  if (!company.ecommerceConfig?.enabled) return res.status(403).json({ error: 'E-commerce integration is not enabled for this store.' });
  if (company.ecommerceConfig.webhookToken !== token) return res.status(401).json({ error: 'Invalid webhook token.' });

  req.company = company;
  req.companyId = company._id;
  next();
}

module.exports = { requireWebhookToken };
