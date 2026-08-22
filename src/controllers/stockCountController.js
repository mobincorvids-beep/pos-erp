const StockCount = require('../models/StockCount');
const stockCountService = require('../services/stockCountService');

async function list(req, res) {
  const rows = await StockCount.find({ companyId: req.companyId }).sort({ createdAt: -1 }).limit(100)
    .populate('items.productId', 'name sku');
  res.json(rows);
}

async function get(req, res) {
  const stockCount = await StockCount.findOne({ _id: req.params.id, companyId: req.companyId })
    .populate('items.productId', 'name sku');
  if (!stockCount) return res.status(404).json({ error: 'Stock count not found.' });
  res.json(stockCount);
}

async function start(req, res) {
  try {
    const stockCount = await stockCountService.startCount({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(stockCount);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function recordCounts(req, res) {
  try {
    const stockCount = await stockCountService.recordCounts(req.params.id, req.body.counts);
    res.json(stockCount);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function submit(req, res) {
  try {
    const stockCount = await stockCountService.submitCount(req.params.id, req.auth.userId);
    res.json(stockCount);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, get, start, recordCounts, submit };
