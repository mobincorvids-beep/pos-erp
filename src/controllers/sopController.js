const sopService = require('../services/sopService');

async function generate(req, res) {
  try {
    const { period, productIds, warehouseId, historyDays, forecastDays } = req.body || {};
    const cycle = await sopService.generateCycle(req.companyId, {
      period, productIds, warehouseId, historyDays, forecastDays, userId: req.user?._id,
    });
    res.json(cycle);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  try {
    res.json(await sopService.listCycles(req.companyId, { status: req.query.status }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function get(req, res) {
  try {
    res.json(await sopService.getCycle(req.companyId, req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

async function updateLine(req, res) {
  try {
    const { consensusDemandQty, consensusSupplyQty, note } = req.body || {};
    const cycle = await sopService.updateLine(req.params.id, req.params.productId, { consensusDemandQty, consensusSupplyQty, note });
    res.json(cycle);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function submit(req, res) {
  try {
    const cycle = await sopService.submitForReview(req.params.id, { requestedBy: req.user?._id, note: req.body?.note });
    res.json(cycle);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function decide(req, res) {
  try {
    const { approve, note } = req.body || {};
    const cycle = await sopService.decide(req.params.id, { approve: !!approve, userId: req.user?._id, note });
    res.json(cycle);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function close(req, res) {
  try {
    res.json(await sopService.closeCycle(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function variance(req, res) {
  try {
    const cycle = await sopService.getCycle(req.companyId, req.params.id);
    res.json(sopService.getVariance(cycle));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { generate, list, get, updateLine, submit, decide, close, variance };
