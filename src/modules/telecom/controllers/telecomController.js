const telecomService = require('../services/telecomService');

async function createPlan(req, res) {
  try { res.status(201).json(await telecomService.createPlan({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listPlans(req, res) { res.json(await telecomService.listPlans(req.companyId)); }
async function subscribeCustomer(req, res) {
  try { res.status(201).json(await telecomService.subscribeCustomer({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listSubscriptions(req, res) { res.json(await telecomService.listSubscriptions(req.companyId, req.query)); }
async function recordUsage(req, res) {
  try { res.json(await telecomService.recordUsage(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function generateMonthlyBill(req, res) {
  try { res.status(201).json(await telecomService.generateMonthlyBill(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createPlan, listPlans, subscribeCustomer, listSubscriptions, recordUsage, generateMonthlyBill };
