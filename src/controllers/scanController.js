const scanService = require('../services/scanService');

async function resolveProduct(req, res) {
  try {
    const result = await scanService.resolveProduct(req.companyId, req.body.code);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function resolveBin(req, res) {
  try {
    const result = await scanService.resolveBin(req.companyId, req.body.binCode, req.body.warehouseId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function confirmPick(req, res) {
  try {
    const line = await scanService.confirmPick({
      companyId: req.companyId,
      pickWaveLineId: req.params.lineId,
      productCode: req.body.productCode,
      binCode: req.body.binCode,
      quantityPicked: Number(req.body.quantityPicked),
    });
    res.json(line);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { resolveProduct, resolveBin, confirmPick };
