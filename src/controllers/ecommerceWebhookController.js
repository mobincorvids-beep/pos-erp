const ecommerceService = require('../services/ecommerceService');

async function productFeed(req, res) {
  try {
    const warehouseId = req.company.ecommerceConfig.defaultWarehouseId;
    const feed = await ecommerceService.getProductFeed(req.companyId, warehouseId);
    res.json(feed);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function importOrder(req, res) {
  try {
    const sale = await ecommerceService.importOrder(req.company, req.body);
    res.status(201).json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { productFeed, importOrder };
