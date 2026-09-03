const dashboardLayoutService = require('../services/dashboardLayoutService');

async function get(req, res) {
  try { res.json(await dashboardLayoutService.getLayout(req.companyId, req.auth.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function save(req, res) {
  try { res.json(await dashboardLayoutService.saveLayout(req.companyId, req.auth.userId, req.body.widgets)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { get, save };
