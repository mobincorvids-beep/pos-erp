const budgetService = require('../services/budgetService');

async function setBudget(req, res) {
  try { res.status(201).json(await budgetService.setBudget({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listBudgetLines(req, res) { res.json(await budgetService.listBudgetLines(req.companyId, req.query)); }
async function budgetVsActual(req, res) {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: '`month` and `year` query params are required.' });
    res.json(await budgetService.budgetVsActual(req.companyId, Number(month), Number(year)));
  } catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { setBudget, listBudgetLines, budgetVsActual };
