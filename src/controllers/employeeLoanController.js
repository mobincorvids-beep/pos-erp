const employeeLoanService = require('../services/employeeLoanService');

async function disburseLoan(req, res) {
  try { res.status(201).json(await employeeLoanService.disburseLoan({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listLoans(req, res) { res.json(await employeeLoanService.listLoans(req.companyId, req.query)); }
async function recordRepayment(req, res) {
  try { res.json(await employeeLoanService.recordRepayment(req.params.employeeId, req.body.amount, { ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { disburseLoan, listLoans, recordRepayment };
