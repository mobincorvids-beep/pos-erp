const travelService = require('../services/travelService');

async function bookPackage(req, res) {
  try { res.status(201).json(await travelService.bookPackage({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listBookings(req, res) { res.json(await travelService.listBookings(req.companyId, req.query)); }
async function finalizeBooking(req, res) {
  try { res.json(await travelService.finalizeBooking(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function cancelBooking(req, res) {
  try { res.json(await travelService.cancelBooking(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { bookPackage, listBookings, finalizeBooking, cancelBooking };
