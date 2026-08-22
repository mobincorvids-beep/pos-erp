const logisticsService = require('../services/logisticsService');

async function createVehicle(req, res) {
  try { res.status(201).json(await logisticsService.createVehicle({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listVehicles(req, res) { res.json(await logisticsService.listVehicles(req.companyId)); }
async function createDriver(req, res) {
  try { res.status(201).json(await logisticsService.createDriver({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listDrivers(req, res) { res.json(await logisticsService.listDrivers(req.companyId)); }
async function startTrip(req, res) {
  try { res.status(201).json(await logisticsService.startTrip({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function addDeliveryToTrip(req, res) {
  try { res.json(await logisticsService.addDeliveryToTrip(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listTrips(req, res) { res.json(await logisticsService.listTrips(req.companyId, req.query)); }
async function completeTrip(req, res) {
  try { res.json(await logisticsService.completeTrip(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createVehicle, listVehicles, createDriver, listDrivers, startTrip, addDeliveryToTrip, listTrips, completeTrip };
