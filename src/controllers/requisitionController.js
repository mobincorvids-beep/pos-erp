const requisitionService = require('../services/requisitionService');
const PurchaseRequisition = require('../models/PurchaseRequisition');

async function list(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await PurchaseRequisition.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(rows);
}

async function create(req, res) {
  try {
    const requisition = await requisitionService.create({ ...req.body, companyId: req.companyId, requestedBy: req.auth.userId });
    res.status(201).json(requisition);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function decide(req, res) {
  try {
    const requisition = await requisitionService.decide(req.params.id, { approve: req.body.approve, userId: req.auth.userId, note: req.body.note });
    res.json(requisition);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function submitQuote(req, res) {
  try {
    const quote = await requisitionService.submitQuote({ ...req.body, companyId: req.companyId, requisitionId: req.params.id });
    res.status(201).json(quote);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function compareQuotes(req, res) {
  const rows = await requisitionService.compareQuotes(req.params.id);
  res.json(rows);
}

module.exports = { list, create, decide, submitQuote, compareQuotes };
