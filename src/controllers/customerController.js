const Customer = require('../models/Customer');
const customerLedgerService = require('../services/customerLedgerService');

async function list(req, res) {
  const customers = await Customer.find({ companyId: req.companyId }).limit(200);
  res.json(customers);
}

async function create(req, res) {
  const customer = await Customer.create({ ...req.body, companyId: req.companyId });
  res.status(201).json(customer);
}

async function getLedger(req, res) {
  try {
    const ledger = await customerLedgerService.ledger(req.params.id);
    res.json(ledger);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function recordPayment(req, res) {
  try {
    const payment = await customerLedgerService.recordPayment({
      ...req.body, customerId: req.params.id, companyId: req.companyId, userId: req.auth.userId,
    });
    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function aging(req, res) {
  const rows = await customerLedgerService.agingReport(req.companyId);
  res.json(rows);
}

module.exports = { list, create, getLedger, recordPayment, aging };
