const cafeSubscriptionService = require('../services/cafeSubscriptionService');

async function sellSubscription(req, res) {
  try {
    const subscription = await cafeSubscriptionService.sellSubscription({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(subscription);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listSubscriptions(req, res) {
  const rows = await cafeSubscriptionService.listSubscriptions(req.companyId, req.query);
  res.json(rows);
}

async function redeemDaily(req, res) {
  try {
    const subscription = await cafeSubscriptionService.redeemDaily(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(subscription);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { sellSubscription, listSubscriptions, redeemDaily };
