const transferService = require('../services/transferService');
const StockTransfer = require('../models/StockTransfer');

async function initiate(req, res) {
  try {
    const transfer = await transferService.initiateTransfer({
      ...req.body,
      companyId: req.companyId,
      userId: req.auth.userId,
    });
    res.status(201).json(transfer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function receive(req, res) {
  try {
    const transfer = await transferService.receiveTransfer(req.params.id, req.auth.userId);
    res.json(transfer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const transfers = await StockTransfer.find({ companyId: req.companyId }).limit(200);
  res.json(transfers);
}

module.exports = { initiate, receive, list };
