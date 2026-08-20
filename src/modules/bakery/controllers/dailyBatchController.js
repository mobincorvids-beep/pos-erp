const dailyBatchService = require('../services/dailyBatchService');

async function produceBatch(req, res) {
  try {
    const batch = await dailyBatchService.produceBatch({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(batch);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listBatches(req, res) {
  const rows = await dailyBatchService.listBatches(req.companyId, req.query);
  res.json(rows);
}

async function closeBatch(req, res) {
  try {
    const batch = await dailyBatchService.closeBatch(req.params.id, { userId: req.auth.userId });
    res.json(batch);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { produceBatch, listBatches, closeBatch };
