const driverService = require('../services/driverService');

async function listDrivers(req, res) {
  try { res.json(await driverService.listDrivers(req.companyId, req.query)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function getDriver(req, res) {
  try { res.json(await driverService.getDriver(req.companyId, req.params.id)); }
  catch (err) { res.status(404).json({ error: err.message }); }
}
async function createDriver(req, res) {
  try { res.status(201).json(await driverService.createDriver({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function updateDriver(req, res) {
  try { res.json(await driverService.updateDriver(req.companyId, req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function addDriverDocument(req, res) {
  try { res.status(201).json(await driverService.addDriverDocument(req.companyId, req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function expiringDocuments(req, res) {
  try {
    const withinDays = req.query.withinDays !== undefined ? Number(req.query.withinDays) : undefined;
    res.json(await driverService.getExpiringDriverDocuments(req.companyId, withinDays));
  } catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { listDrivers, getDriver, createDriver, updateDriver, addDriverDocument, expiringDocuments };
