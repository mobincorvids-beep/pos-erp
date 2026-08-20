const consolidatedReportService = require('../services/consolidatedReportService');

async function group(req, res) {
  try {
    const companies = await consolidatedReportService.getCompanyGroup(req.companyId);
    res.json(companies.map((c) => ({ id: c._id, name: c.name, industryType: c.industryType, isActive: c.isActive })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function salesSummary(req, res) {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: '`from` and `to` query params are required (ISO dates).' });
    const report = await consolidatedReportService.consolidatedSalesSummary(req.companyId, from, to);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function trialBalance(req, res) {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
    const report = await consolidatedReportService.consolidatedTrialBalance(req.companyId, asOfDate);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { group, salesSummary, trialBalance };
