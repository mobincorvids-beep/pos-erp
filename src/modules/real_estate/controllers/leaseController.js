const leaseService = require('../services/leaseService');

async function createProperty(req, res) {
  try { res.status(201).json(await leaseService.createProperty({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listProperties(req, res) { res.json(await leaseService.listProperties(req.companyId, req.query)); }
async function startLease(req, res) {
  try { res.status(201).json(await leaseService.startLease({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listLeases(req, res) { res.json(await leaseService.listLeases(req.companyId, req.query)); }
async function generateRentInvoice(req, res) {
  try { res.status(201).json(await leaseService.generateRentInvoice(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function endLease(req, res) {
  try { res.json(await leaseService.endLease(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createProperty, listProperties, startLease, listLeases, generateRentInvoice, endLease };
