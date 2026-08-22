const costCenterService = require('../services/costCenterService');

async function createCostCenter(req, res) {
  try { res.status(201).json(await costCenterService.createCostCenter({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listCostCenters(req, res) { res.json(await costCenterService.listCostCenters(req.companyId)); }
async function profitAndLoss(req, res) {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: '`from` and `to` query params are required (ISO dates).' });
    res.json(await costCenterService.costCenterProfitAndLoss(req.companyId, req.params.id, from, to));
  } catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createCostCenter, listCostCenters, profitAndLoss };
