const tradeInService = require('../services/tradeInService');

async function intake(req, res) {
  try { res.status(201).json(await tradeInService.intake({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function markApplied(req, res) {
  try { res.json(await tradeInService.markApplied(req.params.id, req.body.saleId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listCredits(req, res) { res.json(await tradeInService.listCredits(req.companyId, req.query)); }
module.exports = { intake, markApplied, listCredits };
