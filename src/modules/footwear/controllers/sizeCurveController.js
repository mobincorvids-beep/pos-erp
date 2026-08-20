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

async function applyCurve(req, res) {
  try {
    const { productId, totalQuantity } = req.body;
    const result = await sizeCurveService.applyCurve(req.params.id, productId, Number(totalQuantity));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { createCurve, listCurves, applyCurve };
