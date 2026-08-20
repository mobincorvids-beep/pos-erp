const distributionPricingService = require('../services/distributionPricingService');

async function setSchedule(req, res) {
  try {
    const schedule = await distributionPricingService.setSchedule({ ...req.body, companyId: req.companyId });
    res.status(201).json(schedule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getSchedule(req, res) {
  const schedule = await distributionPricingService.getSchedule(req.params.variantId);
  if (!schedule) return res.status(404).json({ error: 'No price schedule configured for this variant.' });
  res.json(schedule);
}

async function listSchedules(req, res) {
  const rows = await distributionPricingService.listSchedules(req.companyId);
  res.json(rows);
}

async function quote(req, res) {
  try {
    const quoted = await distributionPricingService.quoteOrder(req.companyId, req.body.items);
    res.json(quoted);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createOrder(req, res) {
  try {
    const order = await distributionPricingService.quoteAndCreateSalesOrder({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { setSchedule, getSchedule, listSchedules, quote, createOrder };
