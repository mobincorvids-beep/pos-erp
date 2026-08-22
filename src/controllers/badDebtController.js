const badDebtService = require('../services/badDebtService');

async function arAgingReport(req, res) {
  const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
  res.json(await badDebtService.arAgingReport(req.companyId, asOfDate));
}
async function writeOffReceivable(req, res) {
  try { res.json(await badDebtService.writeOffReceivable(req.params.saleId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { arAgingReport, writeOffReceivable };
