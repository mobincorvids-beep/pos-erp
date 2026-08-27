const pickWaveService = require('../services/pickWaveService');

async function create(req, res) {
  try {
    const { warehouseId, saleIds, assignedUserId } = req.body;
    const result = await pickWaveService.createPickWave({
      companyId: req.companyId, warehouseId, saleIds, assignedUserId,
    });
    res.status(201).json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function list(req, res) {
  try {
    const waves = await pickWaveService.listPickWaves(req.companyId, req.query.warehouseId);
    res.json(waves);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function lines(req, res) {
  try {
    const rows = await pickWaveService.getPickWaveLines(req.params.id);
    res.json(rows);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function pick(req, res) {
  try {
    const line = await pickWaveService.recordPick(req.params.lineId, Number(req.body.quantityPicked));
    res.json(line);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function complete(req, res) {
  try {
    const wave = await pickWaveService.completeWave(req.params.id);
    res.json(wave);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { create, list, lines, pick, complete };
