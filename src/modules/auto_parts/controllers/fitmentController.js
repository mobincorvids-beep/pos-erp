const fitmentService = require('../services/fitmentService');

async function addFitment(req, res) {
  try {
    const fitment = await fitmentService.addFitment({ ...req.body, companyId: req.companyId });
    res.status(201).json(fitment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function removeFitment(req, res) {
  const fitment = await fitmentService.removeFitment(req.params.id);
  if (!fitment) return res.status(404).json({ error: 'Fitment record not found.' });
  res.json({ ok: true });
}

async function findPartsForVehicle(req, res) {
  try {
    const { make, model, year } = req.query;
    if (!year) throw new Error('year is required.');
    const rows = await fitmentService.findPartsForVehicle(req.companyId, { make, model, year: Number(year) });
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listFitmentsForProduct(req, res) {
  const rows = await fitmentService.listFitmentsForProduct(req.companyId, req.params.productId);
  res.json(rows);
}

module.exports = { addFitment, removeFitment, findPartsForVehicle, listFitmentsForProduct };
