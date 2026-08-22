const societyService = require('../services/societyService');

async function createCharge(req, res) {
  try { res.status(201).json(await societyService.createCharge({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listCharges(req, res) { res.json(await societyService.listCharges(req.companyId)); }
async function enrollMember(req, res) {
  try { res.status(201).json(await societyService.enrollMember({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listMembers(req, res) { res.json(await societyService.listMembers(req.companyId)); }
async function generateInvoices(req, res) {
  try { res.status(201).json(await societyService.generateSocietyInvoices({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listInvoices(req, res) { res.json(await societyService.listInvoices(req.companyId, req.query)); }
async function payInvoice(req, res) {
  try { res.json(await societyService.payInvoice(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function submitComplaint(req, res) {
  try { res.status(201).json(await societyService.submitComplaint({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function assignComplaint(req, res) {
  try { res.json(await societyService.assignComplaint(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function resolveComplaint(req, res) {
  try { res.json(await societyService.resolveComplaint(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listComplaints(req, res) { res.json(await societyService.listComplaints(req.companyId, req.query)); }

module.exports = { createCharge, listCharges, enrollMember, listMembers, generateInvoices, listInvoices, payInvoice, submitComplaint, assignComplaint, resolveComplaint, listComplaints };
