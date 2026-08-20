const Department = require('../models/Department');

async function list(req, res) {
  const rows = await Department.find({ companyId: req.companyId });
  res.json(rows);
}

async function create(req, res) {
  const department = await Department.create({ ...req.body, companyId: req.companyId });
  res.status(201).json(department);
}

module.exports = { list, create };
