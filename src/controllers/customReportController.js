const customReportService = require('../services/customReportService');

function sources(req, res) {
  const list = customReportService.SOURCE_REGISTRY.map((name) => ({
    name, allowedFields: customReportService.sourceFields(name),
  }));
  res.json(list);
}

async function list(req, res) {
  try {
    const rows = await customReportService.listReports(req.companyId);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function get(req, res) {
  try {
    const report = await customReportService.getReport(req.companyId, req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function create(req, res) {
  try {
    const report = await customReportService.createReport(req.companyId, req.body, req.auth.userId);
    res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function update(req, res) {
  try {
    const report = await customReportService.updateReport(req.companyId, req.params.id, req.body);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function remove(req, res) {
  try {
    const result = await customReportService.deleteReport(req.companyId, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function run(req, res) {
  try {
    const rows = await customReportService.runReport(req.companyId, req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function preview(req, res) {
  try {
    const rows = await customReportService.previewReport(req.companyId, req.body);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { sources, list, get, create, update, remove, run, preview };
