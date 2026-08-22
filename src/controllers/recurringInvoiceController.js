const recurringInvoiceService = require('../services/recurringInvoiceService');

async function createTemplate(req, res) {
  try { res.status(201).json(await recurringInvoiceService.createTemplate({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listTemplates(req, res) { res.json(await recurringInvoiceService.listTemplates(req.companyId, req.query)); }
async function pauseTemplate(req, res) {
  try { res.json(await recurringInvoiceService.pauseTemplate(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function resumeTemplate(req, res) {
  try { res.json(await recurringInvoiceService.resumeTemplate(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function cancelTemplate(req, res) {
  try { res.json(await recurringInvoiceService.cancelTemplate(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function generateDueInvoices(req, res) {
  try { res.status(201).json(await recurringInvoiceService.generateDueInvoices(req.companyId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createTemplate, listTemplates, pauseTemplate, resumeTemplate, cancelTemplate, generateDueInvoices };
