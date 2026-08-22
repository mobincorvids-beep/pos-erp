const agricultureService = require('../services/agricultureService');

async function createFarmField(req, res) {
  try { res.status(201).json(await agricultureService.createFarmField({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listFields(req, res) { res.json(await agricultureService.listFields(req.companyId)); }
async function startCropCycle(req, res) {
  try { res.status(201).json(await agricultureService.startCropCycle({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listCropCycles(req, res) { res.json(await agricultureService.listCropCycles(req.companyId, req.query)); }
async function completeHarvest(req, res) {
  try { res.json(await agricultureService.completeHarvest(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function fieldYieldHistory(req, res) {
  try { res.json(await agricultureService.fieldYieldHistory(req.params.fieldId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createFarmField, listFields, startCropCycle, listCropCycles, completeHarvest, fieldYieldHistory };
