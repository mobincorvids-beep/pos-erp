const unitService = require('../services/unitService');

async function createUnit(req, res) {
  try { res.status(201).json(await unitService.createUnit({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listUnits(req, res) { res.json(await unitService.listUnits(req.companyId)); }

async function updateUnit(req, res) {
  try {
    const unit = await unitService.updateUnit(req.companyId, req.params.id, req.body);
    if (!unit) return res.status(404).json({ error: 'Unit not found.' });
    res.json(unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteUnit(req, res) {
  const unit = await unitService.deleteUnit(req.companyId, req.params.id);
  if (!unit) return res.status(404).json({ error: 'Unit not found.' });
  res.json({ ok: true });
}

module.exports = { createUnit, listUnits, updateUnit, deleteUnit };
