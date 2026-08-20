const Expense = require('../models/Expense');
const expenseService = require('../services/expenseService');

async function list(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const expenses = await Expense.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(expenses);
}

async function create(req, res) {
  try {
    const expense = await expenseService.submitExpense({
      ...req.body,
      companyId: req.companyId,
      userId: req.auth.userId,
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function approve(req, res) {
  try {
    const expense = await expenseService.approveExpense(req.params.id, req.auth.userId);
    res.json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function reject(req, res) {
  try {
    const expense = await expenseService.rejectExpense(req.params.id, req.auth.userId, req.body.reason);
    res.json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, create, approve, reject };
