const threeWayMatchService = require('../services/threeWayMatchService');

async function list(req, res) {
  try {
    const rows = await threeWayMatchService.listSupplierInvoices(req.companyId, req.query);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function get(req, res) {
  try {
    const invoice = await threeWayMatchService.getSupplierInvoice(req.params.id, req.companyId);
    if (!invoice) return res.status(404).json({ error: 'Supplier invoice not found.' });
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function create(req, res) {
  try {
    const invoice = await threeWayMatchService.createSupplierInvoice({ ...req.body, companyId: req.companyId });
    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function rematch(req, res) {
  try {
    const invoice = await threeWayMatchService.performMatch(req.params.id, req.companyId);
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function approve(req, res) {
  try {
    const invoice = await threeWayMatchService.approveSupplierInvoice(req.params.id, req.companyId, req.auth.userId);
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function reject(req, res) {
  try {
    const invoice = await threeWayMatchService.rejectSupplierInvoice(req.params.id, req.companyId, req.auth.userId, req.body?.reason);
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, get, create, rematch, approve, reject };
