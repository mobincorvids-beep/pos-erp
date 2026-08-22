const rfqService = require('../services/rfqService');

async function createRFQ(req, res) {
  try { res.status(201).json(await rfqService.createRFQ({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listRFQs(req, res) { res.json(await rfqService.listRFQs(req.companyId, req.query)); }
async function submitQuotation(req, res) {
  try { res.status(201).json(await rfqService.submitQuotation(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listQuotations(req, res) { res.json(await rfqService.listQuotations(req.params.id)); }
async function compareQuotations(req, res) {
  try { res.json(await rfqService.compareQuotations(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function convertBestPriceToOrders(req, res) {
  try { res.status(201).json(await rfqService.convertBestPriceToOrders(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createRFQ, listRFQs, submitQuotation, listQuotations, compareQuotations, convertBestPriceToOrders };
