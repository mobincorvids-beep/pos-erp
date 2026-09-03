const inventoryValuationService = require('../services/inventoryValuationService');

async function getHistorical(req, res) {
  try {
    if (!req.query.asOfDate) return res.status(400).json({ error: 'asOfDate is required.' });
    const result = await inventoryValuationService.getHistoricalValuationReport(req.companyId, {
      asOfDate: req.query.asOfDate, warehouseId: req.query.warehouseId,
    });
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { getHistorical };
