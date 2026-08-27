const DeveloperWebhookSubscription = require('../models/DeveloperWebhookSubscription');
const webhookSubscriptionService = require('../services/webhookSubscriptionService');

async function list(req, res) {
  res.json(await webhookSubscriptionService.listSubscriptions(req.companyId));
}

async function events(req, res) {
  res.json(DeveloperWebhookSubscription.WEBHOOK_EVENTS);
}

async function create(req, res) {
  try {
    const { url, event, secret } = req.body;
    const sub = await webhookSubscriptionService.createSubscription(req.companyId, { url, event, secret });
    res.status(201).json(sub);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function remove(req, res) {
  try {
    await webhookSubscriptionService.deleteSubscription(req.companyId, req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

module.exports = { list, events, create, remove };
