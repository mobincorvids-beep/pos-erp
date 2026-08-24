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

/** Only a still-pending prescription can be edited — once dispensing has started it's a
 * billing record (same reasoning as Sale, SaleReturn: you correct forward, not backward). */
async function update(req, res) {
  const prescription = await Prescription.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!prescription) return res.status(404).json({ error: 'Prescription not found.' });
  if (prescription.status !== 'pending') {
    return res.status(400).json({ error: `Cannot edit a prescription that is already "${prescription.status}".` });
  }
  const { doctorId, items, notes } = req.body;
  if (doctorId !== undefined) prescription.doctorId = doctorId;
  if (items !== undefined) prescription.items = items;
  if (notes !== undefined) prescription.notes = notes;
  await prescription.save();
  res.json(prescription);
}

/** Cancels a prescription that was never dispensed — nothing to reverse in stock/accounting
 * since dispense() is what actually touches those. */
async function cancel(req, res) {
  const prescription = await Prescription.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!prescription) return res.status(404).json({ error: 'Prescription not found.' });
  if (prescription.status !== 'pending') {
    return res.status(400).json({ error: `Cannot cancel a prescription that is already "${prescription.status}".` });
  }
  await prescription.deleteOne();
  res.json({ ok: true });
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

module.exports = { create, list, update, cancel, dispense, nearExpiry };
