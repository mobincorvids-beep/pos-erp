const fuelShiftService = require('../services/fuelShiftService');

async function createDispenser(req, res) {
  try { res.status(201).json(await fuelShiftService.createDispenser({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listDispensers(req, res) { res.json(await fuelShiftService.listDispensers(req.companyId, req.query.branchId)); }
async function openShift(req, res) {
  try { res.status(201).json(await fuelShiftService.openShift(req.params.dispenserId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listShifts(req, res) { res.json(await fuelShiftService.listShifts(req.companyId, req.query)); }
async function closeShift(req, res) {
  try { res.json(await fuelShiftService.closeShift(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createDispenser, listDispensers, openShift, listShifts, closeShift };
