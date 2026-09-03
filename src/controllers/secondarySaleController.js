const secondarySaleService = require('../services/secondarySaleService');

async function upsert(req, res) {
  try {
    const row = await secondarySaleService.upsert(req.companyId, req.auth.userId, req.body);
    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const rows = await secondarySaleService.list(req.companyId, {
    customerId: req.query.customerId, productId: req.query.productId, period: req.query.period,
  });
  res.json(rows);
}

async function remove(req, res) {
  const row = await secondarySaleService.remove(req.companyId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Secondary sale record not found.' });
  res.json({ ok: true });
}

async function summary(req, res) {
  if (!req.query.period) return res.status(400).json({ error: 'period query param is required.' });
  const rows = await secondarySaleService.summaryByPeriod(req.companyId, req.query.period);
  res.json(rows);
}

module.exports = { upsert, list, remove, summary };
