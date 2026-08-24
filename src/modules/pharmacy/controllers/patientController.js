const Patient = require('../models/Patient');

async function list(req, res) {
  const patients = await Patient.find({ companyId: req.companyId }).limit(200);
  res.json(patients);
}

async function create(req, res) {
  const patient = await Patient.create({ ...req.body, companyId: req.companyId });
  res.status(201).json(patient);
}

/** Was missing — a patient's phone/allergies/conditions could never be corrected or updated
 * after intake, which matters most for exactly the fields (allergies, chronic conditions) a
 * pharmacy relies on to catch a dangerous prescription. */
async function update(req, res) {
  const { name, age, gender, phone, allergies, chronicConditions, customerId } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (age !== undefined) updates.age = age;
  if (gender !== undefined) updates.gender = gender;
  if (phone !== undefined) updates.phone = phone;
  if (allergies !== undefined) updates.allergies = allergies;
  if (chronicConditions !== undefined) updates.chronicConditions = chronicConditions;
  if (customerId !== undefined) updates.customerId = customerId;

  const patient = await Patient.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, updates, { new: true, runValidators: true });
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  res.json(patient);
}

module.exports = { list, create, update };
