const sizeCurveService = require('../services/sizeCurveService');

async function createCurve(req, res) {
  try {
    const curve = await sizeCurveService.createCurve({ ...req.body, companyId: req.companyId });
    res.status(201).json(curve);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listCurves(req, res) {
  const rows = await sizeCurveService.listCurves(req.companyId);
  res.json(rows);
}

async function updateCurve(req, res) {
  try {
    const curve = await sizeCurveService.updateCurve(req.companyId, req.params.id, req.body);
    if (!curve) return res.status(404).json({ error: 'Size curve not found.' });
    res.json(curve);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteCurve(req, res) {
  try {
    await sizeCurveService.deleteCurve(req.companyId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

async function applyCurve(req, res) {
  try {
    const { productId, totalQuantity } = req.body;
    const result = await sizeCurveService.applyCurve(req.params.id, productId, Number(totalQuantity));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { createCurve, listCurves, updateCurve, deleteCurve, applyCurve };
