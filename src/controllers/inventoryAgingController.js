const inventoryAgingService = require('../services/inventoryAgingService');

async function getAging(req, res) {
  try {
    const result = await inventoryAgingService.getInventoryAgingReport(req.companyId, { warehouseId: req.query.warehouseId });
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function writeOff(req, res) {
  try {
    const result = await inventoryAgingService.writeOffInventory(req.companyId, {
      productId: req.body.productId, variantId: req.body.variantId, batchId: req.body.batchId || null,
      quantity: req.body.quantity, reason: req.body.reason, userId: req.auth.userId,
    });
    res.status(201).json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { getAging, writeOff };
