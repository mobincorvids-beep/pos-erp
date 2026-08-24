const Doctor = require('../models/Doctor');

/** Was missing entirely — the Doctor model existed (referenced by
 * Prescription.doctorId) but had no controller or routes, so there was no
 * way to actually register a doctor to attach to a prescription. */

async function list(req, res) {
  const doctors = await Doctor.find({ companyId: req.companyId, isActive: true });
  res.json(doctors);
}

async function create(req, res) {
  try {
    const { name, registrationNumber, specialization, phone } = req.body;
    if (!name) throw new Error('Doctor name is required.');
    const doctor = await Doctor.create({ companyId: req.companyId, name, registrationNumber, specialization, phone });
    res.status(201).json(doctor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function update(req, res) {
  const { name, registrationNumber, specialization, phone } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (registrationNumber !== undefined) updates.registrationNumber = registrationNumber;
  if (specialization !== undefined) updates.specialization = specialization;
  if (phone !== undefined) updates.phone = phone;

  const doctor = await Doctor.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, updates, { new: true, runValidators: true });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
  res.json(doctor);
}

/** Soft-delete — a doctor referenced by past prescriptions shouldn't vanish from history. */
async function remove(req, res) {
  const doctor = await Doctor.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, { isActive: false }, { new: true });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
