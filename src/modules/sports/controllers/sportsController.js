const sportsService = require('../services/sportsService');

async function createFacility(req, res) {
  try { res.status(201).json(await sportsService.createFacility({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listFacilities(req, res) { res.json(await sportsService.listFacilities(req.companyId, req.query.branchId)); }
async function bookSlot(req, res) {
  try { res.status(201).json(await sportsService.bookSlot(req.params.facilityId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listBookings(req, res) { res.json(await sportsService.listBookings(req.companyId, req.query)); }
async function cancelSlot(req, res) {
  try { res.json(await sportsService.cancelSlot(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createFacility, listFacilities, bookSlot, listBookings, cancelSlot };
