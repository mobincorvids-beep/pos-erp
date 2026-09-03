const fleetAnalyticsService = require('../services/fleetAnalyticsService');

async function fuelEfficiencyReport(req, res) {
  try {
    const { from, to, thresholdPct } = req.query;
    res.json(await fleetAnalyticsService.fuelEfficiencyReport(req.companyId, {
      from, to, thresholdPct: thresholdPct !== undefined ? Number(thresholdPct) : undefined,
    }));
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function listFreightRates(req, res) {
  try { res.json(await fleetAnalyticsService.listFreightRates(req.companyId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function getActiveFreightRate(req, res) {
  try {
    const rate = await fleetAnalyticsService.getActiveFreightRate(req.companyId);
    if (!rate) return res.status(404).json({ error: 'No active freight rate configured for this company.' });
    res.json(rate);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function setFreightRate(req, res) {
  try { res.status(201).json(await fleetAnalyticsService.setFreightRate(req.companyId, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function quoteFreight(req, res) {
  try { res.json(await fleetAnalyticsService.quoteFreight(req.companyId, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { fuelEfficiencyReport, listFreightRates, getActiveFreightRate, setFreightRate, quoteFreight };
