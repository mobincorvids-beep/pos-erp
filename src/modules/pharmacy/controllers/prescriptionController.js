const Prescription = require('../models/Prescription');
const pharmacyService = require('../services/pharmacyService');

async function create(req, res) {
  const prescription = await Prescription.create({ ...req.body, companyId: req.companyId });
  res.status(201).json(prescription);
}

async function list(req, res) {
  const prescriptions = await Prescription.find({ companyId: req.companyId }).limit(200);
  res.json(prescriptions);
}

async function dispense(req, res) {
  try {
    const result = await pharmacyService.dispensePrescription({
      prescriptionId: req.params.id,
      saleInput: { ...req.body, companyId: req.companyId, userId: req.auth.userId },
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function nearExpiry(req, res) {
  const days = req.query.days ? Number(req.query.days) : 30;
  const rows = await pharmacyService.nearExpiryReport(req.companyId, days);
  res.json(rows);
}

module.exports = { create, list, dispense, nearExpiry };
