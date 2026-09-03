const chequeService = require('../services/chequeService');

async function record(req, res) {
  try {
    const cheque = await chequeService.recordChequePayment({
      ...req.body, companyId: req.companyId, userId: req.auth.userId,
    });
    res.status(201).json(cheque);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const { status, direction, from, to } = req.query;
  const cheques = await chequeService.list(req.companyId, { status, direction, from, to });
  res.json(cheques);
}

async function dueSoon(req, res) {
  const days = req.query.days ? Number(req.query.days) : 7;
  const cheques = await chequeService.dueSoon(req.companyId, days);
  res.json(cheques);
}

async function markCleared(req, res) {
  try {
    const cheque = await chequeService.markCleared(req.params.id, req.companyId);
    res.json(cheque);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function markBounced(req, res) {
  try {
    const cheque = await chequeService.markBounced(req.params.id, req.companyId, {
      reason: req.body.reason, userId: req.auth.userId,
    });
    res.json(cheque);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { record, list, dueSoon, markCleared, markBounced };
