const warehouseZoneService = require('../services/warehouseZoneService');
const WarehouseBin = require('../models/WarehouseBin');
const BinStock = require('../models/BinStock');

async function createZone(req, res) {
  try {
    const zone = await warehouseZoneService.createZone({ ...req.body, companyId: req.companyId });
    res.status(201).json(zone);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function listZones(req, res) {
  try {
    const zones = await warehouseZoneService.listZones(req.companyId, req.query.warehouseId);
    res.json(zones);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function createBin(req, res) {
  try {
    const bin = await warehouseZoneService.createBin({ ...req.body, companyId: req.companyId });
    res.status(201).json(bin);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function listBins(req, res) {
  try {
    if (!req.query.warehouseId) return res.status(400).json({ error: 'warehouseId is required.' });
    const bins = await warehouseZoneService.listBins(req.query.warehouseId, req.companyId);
    res.json(bins);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function updateBin(req, res) {
  try {
    const bin = await WarehouseBin.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { $set: req.body },
      { new: true }
    );
    if (!bin) return res.status(404).json({ error: 'Bin not found.' });
    res.json(bin);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function assignStock(req, res) {
  try {
    const { binId, productId, quantity } = req.body;
    const result = await warehouseZoneService.assignStockToBin(binId, productId, Number(quantity));
    res.status(201).json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function moveStock(req, res) {
  try {
    const { fromBinId, toBinId, productId, quantity } = req.body;
    const result = await warehouseZoneService.moveBinStock(fromBinId, toBinId, productId, Number(quantity));
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function stockSummary(req, res) {
  try {
    if (!req.query.warehouseId) return res.status(400).json({ error: 'warehouseId is required.' });
    const summary = await warehouseZoneService.binStockSummary(req.query.warehouseId);
    res.json(summary);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function listBinStockRaw(req, res) {
  try {
    if (!req.query.warehouseId) return res.status(400).json({ error: 'warehouseId is required.' });
    const rows = await BinStock.find({ companyId: req.companyId, warehouseId: req.query.warehouseId, quantity: { $gt: 0 } });
    res.json(rows);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = {
  createZone, listZones, createBin, listBins, updateBin,
  assignStock, moveStock, stockSummary, listBinStockRaw,
};
