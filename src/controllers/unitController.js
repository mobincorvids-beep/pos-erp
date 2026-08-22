const unitService = require('../services/unitService');

async function createUnit(req, res) {
  try { res.status(201).json(await unitService.createUnit({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listUnits(req, res) { res.json(await unitService.listUnits(req.companyId)); }
module.exports = { createUnit, listUnits };
