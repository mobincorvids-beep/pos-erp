const Patient = require('../models/Patient');

async function list(req, res) {
  const patients = await Patient.find({ companyId: req.companyId }).limit(200);
  res.json(patients);
}

async function create(req, res) {
  const patient = await Patient.create({ ...req.body, companyId: req.companyId });
  res.status(201).json(patient);
}

module.exports = { list, create };
