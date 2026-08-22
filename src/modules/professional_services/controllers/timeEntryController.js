const timeEntryService = require('../services/timeEntryService');

async function logTime(req, res) {
  try { res.status(201).json(await timeEntryService.logTime({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listUnbilledEntries(req, res) { res.json(await timeEntryService.listUnbilledEntries(req.companyId, req.query.clientCustomerId)); }
async function generateInvoice(req, res) {
  try { res.status(201).json(await timeEntryService.generateInvoice(req.companyId, req.params.clientCustomerId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listInvoicedEntries(req, res) { res.json(await timeEntryService.listInvoicedEntries(req.companyId, req.query)); }
module.exports = { logTime, listUnbilledEntries, generateInvoice, listInvoicedEntries };
