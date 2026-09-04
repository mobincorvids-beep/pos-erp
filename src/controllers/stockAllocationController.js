const stockAllocationService = require('../services/stockAllocationService');

async function plan(req, res) {
  try {
    const { productId, variantId, warehouseId, rule } = req.query;
    const result = await stockAllocationService.buildAllocationPlan(req.companyId, { productId, variantId, warehouseId, rule });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function apply(req, res) {
  try {
    const { productId, variantId, warehouseId, rule } = req.body;
    const result = await stockAllocationService.applyAllocation(req.companyId, { productId, variantId, warehouseId, rule });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function listRules(req, res) {
  res.json(stockAllocationService.RULES);
}

module.exports = { plan, apply, listRules };
