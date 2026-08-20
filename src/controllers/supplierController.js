const Supplier = require('../models/Supplier');
const supplierLedgerService = require('../services/supplierLedgerService');

async function list(req, res) {
  const suppliers = await Supplier.find({ companyId: req.companyId }).limit(200);
  res.json(suppliers);
}

async function create(req, res) {
  const supplier = await Supplier.create({ ...req.body, companyId: req.companyId });
  res.status(201).json(supplier);
}

async function getLedger(req, res) {
  try {
    const ledger = await supplierLedgerService.ledger(req.params.id);
    res.json(ledger);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function recordPayment(req, res) {
  try {
    const payment = await supplierLedgerService.recordPayment({
      ...req.body, supplierId: req.params.id, companyId: req.companyId, userId: req.auth.userId,
    });
    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function aging(req, res) {
  const rows = await supplierLedgerService.agingReport(req.companyId);
  res.json(rows);
}

module.exports = { list, create, getLedger, recordPayment, aging };
