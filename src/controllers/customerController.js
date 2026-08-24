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

/** Was missing entirely — a wrong phone number, address, or credit limit had no way to be
 * corrected after intake. Deliberately excludes openingBalance and loyaltyPoints: those are
 * ledger-derived running totals, not free-text fields — changing them here would silently
 * desync the customer record from customerLedgerService's own math. */
async function update(req, res) {
  const allowed = ['name', 'phone', 'email', 'address', 'creditLimit', 'priceGroupId', 'tags'];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];

  const customer = await Customer.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, updates, { new: true, runValidators: true });
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });
  res.json(customer);
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

module.exports = { list, create, update, getLedger, recordPayment, aging };
