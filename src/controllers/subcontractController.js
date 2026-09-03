const subcontractService = require('../services/subcontractService');

async function list(req, res) {
  const rows = await subcontractService.listOrders(req.companyId, req.query);
  res.json(rows);
}

async function get(req, res) {
  try {
    const order = await subcontractService.getOrder(req.companyId, req.params.id);
    res.json(order);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

async function create(req, res) {
  try {
    const order = await subcontractService.createOrder({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function receive(req, res) {
  try {
    const order = await subcontractService.receiveItems(req.companyId, req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function close(req, res) {
  try {
    const order = await subcontractService.closeOrder(req.companyId, req.params.id, { userId: req.auth.userId });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, get, create, receive, close };
