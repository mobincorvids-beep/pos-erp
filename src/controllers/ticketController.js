const ticketService = require('../services/ticketService');

async function createTicket(req, res) {
  try { res.status(201).json(await ticketService.createTicket({ ...req.body, companyId: req.companyId, raisedByUserId: req.body.customerId ? undefined : req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listTickets(req, res) { res.json(await ticketService.listTickets(req.companyId, req.query)); }
async function assignTicket(req, res) {
  try { res.json(await ticketService.assignTicket(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function resolveTicket(req, res) {
  try { res.json(await ticketService.resolveTicket(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function closeTicket(req, res) {
  try { res.json(await ticketService.closeTicket(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function slaComplianceReport(req, res) { res.json(await ticketService.slaComplianceReport(req.companyId)); }

module.exports = { createTicket, listTickets, assignTicket, resolveTicket, closeTicket, slaComplianceReport };
