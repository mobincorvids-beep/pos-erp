const fleetService = require('../services/fleetService');

async function registerVehicle(req, res) {
  try { res.status(201).json(await fleetService.registerVehicle({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listVehicles(req, res) {
  try { res.json(await fleetService.listVehicles(req.companyId, req.query)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function getVehicle(req, res) {
  try { res.json(await fleetService.getVehicle(req.companyId, req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function updateVehicle(req, res) {
  try { res.json(await fleetService.updateVehicle(req.companyId, req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function updateVehicleStatus(req, res) {
  try { res.json(await fleetService.updateVehicleStatus(req.companyId, req.params.id, req.body.status)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function retireVehicle(req, res) {
  try { res.json(await fleetService.retireVehicle(req.companyId, req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function listFuelLogs(req, res) {
  try { res.json(await fleetService.listFuelLogs(req.companyId, req.query)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function logFuel(req, res) {
  try { res.status(201).json(await fleetService.logFuel({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function listTrips(req, res) {
  try { res.json(await fleetService.listTrips(req.companyId, req.query)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function startTrip(req, res) {
  try { res.status(201).json(await fleetService.startTrip({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function completeTrip(req, res) {
  try { res.json(await fleetService.completeTrip(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function cancelTrip(req, res) {
  const trip = await fleetService.cancelTrip(req.params.id);
  if (!trip) return res.status(400).json({ error: 'Trip not found or already completed/cancelled.' });
  res.json(trip);
}

async function vehicleHistory(req, res) {
  try { res.json(await fleetService.vehicleHistory(req.companyId, req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = {
  registerVehicle, listVehicles, getVehicle, updateVehicle, updateVehicleStatus, retireVehicle,
  listFuelLogs, logFuel,
  listTrips, startTrip, completeTrip, cancelTrip,
  vehicleHistory,
};
