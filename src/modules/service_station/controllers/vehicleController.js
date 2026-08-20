const vehicleService = require('../services/vehicleService');

async function listVehicles(req, res) {
  const rows = await vehicleService.listVehicles(req.companyId, req.query.customerId || null);
  res.json(rows);
}

async function registerVehicle(req, res) {
  try {
    const vehicle = await vehicleService.registerVehicle({ ...req.body, companyId: req.companyId });
    res.status(201).json(vehicle);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateMileage(req, res) {
  try {
    const vehicle = await vehicleService.updateMileage(req.params.id, req.body.mileage);
    res.json(vehicle);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function openJobCard(req, res) {
  try {
    const jobCard = await vehicleService.openJobCard({ ...req.body, vehicleId: req.params.id, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(jobCard);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function recordServiceCompleted(req, res) {
  try {
    const vehicle = await vehicleService.recordServiceCompleted(req.params.id, req.body);
    res.json(vehicle);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listServiceDue(req, res) {
  const rows = await vehicleService.listServiceDue(req.companyId);
  res.json(rows);
}

async function serviceHistory(req, res) {
  const rows = await vehicleService.serviceHistory(req.params.id);
  res.json(rows);
}

module.exports = { listVehicles, registerVehicle, updateMileage, openJobCard, recordServiceCompleted, listServiceDue, serviceHistory };
