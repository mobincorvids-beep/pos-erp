const aiInsightsService = require('../services/aiInsightsService');

async function reorderRecommendations(req, res) {
  try {
    const rows = await aiInsightsService.reorderRecommendations(req.companyId, req.query.warehouseId || null);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function slowMoving(req, res) {
  try {
    const rows = await aiInsightsService.slowMovingInventory(req.companyId, Number(req.query.days) || 60, req.query.warehouseId || null);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function salesAnomalies(req, res) {
  try {
    const result = await aiInsightsService.salesAnomalies(req.companyId, Number(req.query.thresholdPercent) || 25);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function briefing(req, res) {
  try {
    const result = await aiInsightsService.briefing(req.companyId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { reorderRecommendations, slowMoving, salesAnomalies, briefing };
