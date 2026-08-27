const salesChannelService = require('../services/salesChannelService');

async function create(req, res) {
  try {
    const channel = await salesChannelService.createChannel(req.companyId, req.body);
    res.status(201).json(channel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const channels = await salesChannelService.listChannels(req.companyId);
  res.json(channels);
}

async function toggle(req, res) {
  try {
    const channel = await salesChannelService.toggleChannel(req.companyId, req.params.id);
    res.json(channel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function regenerateToken(req, res) {
  try {
    const channel = await salesChannelService.regenerateToken(req.companyId, req.params.id);
    res.json(channel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function analytics(req, res) {
  const data = await salesChannelService.channelAnalytics(req.companyId);
  res.json(data);
}

/** Public webhook receiver — no requireAuth/scopeToCompany, mirrors ecommerceWebhookRoutes.js's pattern of resolving tenant from the credential itself (here, the per-channel token) rather than a JWT. */
async function webhook(req, res) {
  try {
    const channelOrder = await salesChannelService.receiveOrder(req.params.token, req.body);
    res.status(201).json(channelOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, toggle, regenerateToken, analytics, webhook };
