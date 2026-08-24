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

/** Was missing — a renamed category or corrected default account had no way in. */
async function update(req, res) {
  try {
    const category = await ExpenseCategory.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId }, req.body, { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ error: 'Expense category not found.' });
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** Was missing — no way to remove a category created by mistake. Past Expense records keep
 * whatever categoryId they already have; nothing cascades. */
async function remove(req, res) {
  const category = await ExpenseCategory.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
  if (!category) return res.status(404).json({ error: 'Expense category not found.' });
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
