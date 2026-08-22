const eventTicketingService = require('../services/eventTicketingService');

async function createShow(req, res) {
  try { res.status(201).json(await eventTicketingService.createShow({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listShows(req, res) { res.json(await eventTicketingService.listShows(req.companyId, req.query)); }
async function bookTicket(req, res) {
  try { res.status(201).json(await eventTicketingService.bookTicket(req.params.showId, req.params.tierId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function cancelTicket(req, res) {
  try { res.json(await eventTicketingService.cancelTicket(req.params.showId, req.params.tierId, req.params.customerId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function showRoster(req, res) {
  const show = await eventTicketingService.showRoster(req.params.showId);
  if (!show) return res.status(404).json({ error: 'Show not found.' });
  res.json(show);
}
module.exports = { createShow, listShows, bookTicket, cancelTicket, showRoster };
