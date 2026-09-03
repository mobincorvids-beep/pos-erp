const networkStockService = require('../services/networkStockService');

async function getView(req, res) {
  try {
    const result = await networkStockService.getNetworkStockView(req.companyId, { productId: req.query.productId });
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { getView };
