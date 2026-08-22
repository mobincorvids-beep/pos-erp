const fundService = require('../services/fundService');

async function createFund(req, res) {
  try { res.status(201).json(await fundService.createFund({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listFunds(req, res) { res.json(await fundService.listFunds(req.companyId, req.query)); }
async function recordDonation(req, res) {
  try { res.status(201).json(await fundService.recordDonation(req.params.fundId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function recordDisbursement(req, res) {
  try { res.status(201).json(await fundService.recordDisbursement(req.params.fundId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function fundLedger(req, res) { res.json(await fundService.fundLedger(req.params.fundId)); }
module.exports = { createFund, listFunds, recordDonation, recordDisbursement, fundLedger };
