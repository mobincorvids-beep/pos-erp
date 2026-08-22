const dashboardService = require('../services/dashboardService');

async function getDashboard(req, res) {
  try {
    const result = await dashboardService.getDashboard(req.companyId, req.auth);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getHomeDashboard(req, res) {
  try {
    const result = await dashboardService.getHomeDashboard(req.companyId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { getDashboard, getHomeDashboard };
