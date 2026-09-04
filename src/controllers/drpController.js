const drpService = require('../services/drpService');

async function suggestTransfers(req, res) {
  try {
    const { dcWarehouseId } = req.query;
    if (!dcWarehouseId) return res.status(400).json({ error: 'dcWarehouseId is required.' });
    const result = await drpService.suggestTransfers(req.companyId, dcWarehouseId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { suggestTransfers };
