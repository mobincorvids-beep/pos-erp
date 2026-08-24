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

/** Was missing — same reasoning as customerController.update: openingBalance stays out
 * since it's a ledger-derived total, not a free-text field. */
async function update(req, res) {
  const allowed = ['name', 'phone', 'email', 'address'];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];

  const supplier = await Supplier.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, updates, { new: true, runValidators: true });
  if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
  res.json(supplier);
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

module.exports = { list, create, update, getLedger, recordPayment, aging };
