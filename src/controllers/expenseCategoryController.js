const ExpenseCategory = require('../models/ExpenseCategory');

async function list(req, res) {
  const categories = await ExpenseCategory.find({ companyId: req.companyId });
  res.json(categories);
}

async function create(req, res) {
  try {
    const category = await ExpenseCategory.create({ ...req.body, companyId: req.companyId });
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, create };
