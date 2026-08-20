const fefoService = require('../services/fefoService');

async function suggestPickOrder(req, res) {
  try {
    const { warehouseId, variantId, quantity } = req.query;
    if (!warehouseId || !variantId || !quantity) throw new Error('warehouseId, variantId, and quantity are all required.');
    const result = await fefoService.suggestPickOrder(warehouseId, variantId, Number(quantity));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { suggestPickOrder };
