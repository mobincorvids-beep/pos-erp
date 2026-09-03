const vehicleIncidentService = require('../services/vehicleIncidentService');

async function listIncidents(req, res) {
  try { res.json(await vehicleIncidentService.listIncidents(req.companyId, req.query)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function getIncident(req, res) {
  try { res.json(await vehicleIncidentService.getIncident(req.companyId, req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function createIncident(req, res) {
  try {
    res.status(201).json(await vehicleIncidentService.createIncident({
      ...req.body, companyId: req.companyId, createdBy: req.auth.userId,
    }));
  } catch (err) { res.status(400).json({ error: err.message }); }
}
async function updateIncident(req, res) {
  try { res.json(await vehicleIncidentService.updateIncident(req.companyId, req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { listIncidents, getIncident, createIncident, updateIncident };
