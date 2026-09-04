const fleetMaintenanceService = require('../services/fleetMaintenanceService');

async function listSchedules(req, res) {
  try {
    const rows = await fleetMaintenanceService.listSchedules(req.companyId, req.query);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createSchedule(req, res) {
  try {
    const schedule = await fleetMaintenanceService.createSchedule({
      ...req.body, companyId: req.companyId, createdBy: req.auth.userId,
    });
    res.status(201).json(schedule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function recordServiceCompleted(req, res) {
  try {
    const schedule = await fleetMaintenanceService.recordServiceCompleted(req.params.id, req.companyId, req.body);
    res.json(schedule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getDueMaintenanceSchedules(req, res) {
  try {
    const { withinDays, notify } = req.query;
    const due = await fleetMaintenanceService.getDueMaintenanceSchedules(req.companyId, {
      withinDays: withinDays ? Number(withinDays) : undefined,
      notify: notify === 'true',
    });
    res.json(due);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getExpiringVehicleCompliance(req, res) {
  try {
    const withinDays = req.query.withinDays ? Number(req.query.withinDays) : undefined;
    const result = await fleetMaintenanceService.getExpiringVehicleCompliance(req.companyId, withinDays);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { listSchedules, createSchedule, recordServiceCompleted, getDueMaintenanceSchedules, getExpiringVehicleCompliance };
