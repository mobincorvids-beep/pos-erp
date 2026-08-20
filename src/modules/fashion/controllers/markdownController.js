const markdownService = require('../services/markdownService');

async function setSchedule(req, res) {
  try {
    const schedule = await markdownService.setSchedule({ ...req.body, companyId: req.companyId });
    res.status(201).json(schedule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getSchedule(req, res) {
  const schedule = await markdownService.getSchedule(req.params.variantId);
  if (!schedule) return res.status(404).json({ error: 'No markdown schedule configured for this variant.' });
  res.json(schedule);
}

async function listSchedules(req, res) {
  const rows = await markdownService.listSchedules(req.companyId);
  res.json(rows);
}

async function currentPrice(req, res) {
  try {
    const result = await markdownService.currentPrice(req.companyId, req.params.variantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { setSchedule, getSchedule, listSchedules, currentPrice };
