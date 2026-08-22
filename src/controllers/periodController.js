const periodService = require('../services/periodService');

async function createFiscalYear(req, res) {
  try { res.status(201).json(await periodService.createFiscalYear({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listFiscalYears(req, res) { res.json(await periodService.listFiscalYears(req.companyId)); }
async function createAccountingPeriod(req, res) {
  try { res.status(201).json(await periodService.createAccountingPeriod({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listAccountingPeriods(req, res) { res.json(await periodService.listAccountingPeriods(req.companyId)); }
async function closePeriod(req, res) {
  try { res.json(await periodService.closePeriod(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function reopenPeriod(req, res) {
  try { res.json(await periodService.reopenPeriod(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createFiscalYear, listFiscalYears, createAccountingPeriod, listAccountingPeriods, closePeriod, reopenPeriod };
