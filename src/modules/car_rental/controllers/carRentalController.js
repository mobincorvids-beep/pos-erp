const carRentalService = require('../services/carRentalService');

async function addVehicle(req, res) {
  try { res.status(201).json(await carRentalService.addVehicle({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listFleet(req, res) { res.json(await carRentalService.listFleet(req.companyId, req.query)); }
async function bookRental(req, res) {
  try { res.status(201).json(await carRentalService.bookRental({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listBookings(req, res) { res.json(await carRentalService.listBookings(req.companyId, req.query)); }
async function returnVehicle(req, res) {
  try { res.json(await carRentalService.returnVehicle(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { addVehicle, listFleet, bookRental, listBookings, returnVehicle };
