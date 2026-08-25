const furnitureService = require('../services/furnitureService');

async function placeOrder(req, res) {
  try {
    const order = await furnitureService.placeOrder({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listOrders(req, res) {
  const rows = await furnitureService.listOrders(req.companyId, req.query);
  res.json(rows);
}

async function updateOrder(req, res) {
  try {
    const order = await furnitureService.updateOrder(req.companyId, req.params.id, req.body);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function cancelOrder(req, res) {
  try {
    const order = await furnitureService.cancelOrder(req.companyId, req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function startProduction(req, res) {
  try {
    const order = await furnitureService.startProduction(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function markReady(req, res) {
  try {
    const order = await furnitureService.markReady(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deliver(req, res) {
  try {
    const result = await furnitureService.deliver(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function onTimeDeliveryRate(req, res) {
  const result = await furnitureService.onTimeDeliveryRate(req.companyId);
  res.json(result);
}

module.exports = { placeOrder, listOrders, updateOrder, cancelOrder, startProduction, markReady, deliver, onTimeDeliveryRate };
