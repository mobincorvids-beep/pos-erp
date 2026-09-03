const scheduledReportService = require('../services/scheduledReportService');

async function list(req, res) {
  try { res.json(await scheduledReportService.listScheduledReports(req.companyId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function create(req, res) {
  try {
    const sr = await scheduledReportService.createScheduledReport({ ...req.body, companyId: req.companyId, createdBy: req.auth.userId });
    res.status(201).json(sr);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function get(req, res) {
  try { res.json(await scheduledReportService.getScheduledReport(req.companyId, req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function update(req, res) {
  try { res.json(await scheduledReportService.updateScheduledReport(req.companyId, req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function remove(req, res) {
  try { await scheduledReportService.deleteScheduledReport(req.companyId, req.params.id); res.status(204).end(); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function due(req, res) {
  try { res.json(await scheduledReportService.getDueScheduledReports(req.companyId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

/** Manually trigger the render+email for one scheduled report right now (also what an actual scheduler would call once wired). */
async function send(req, res) {
  try { res.json(await scheduledReportService.renderAndQueueReport(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { list, create, get, update, remove, due, send };
