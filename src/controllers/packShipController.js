const packShipService = require('../services/packShipService');

async function create(req, res) {
  try {
    const shipment = await packShipService.createFromPickWave({ ...req.body, companyId: req.companyId });
    res.status(201).json(shipment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function get(req, res) {
  try {
    const shipment = await packShipService.getShipment(req.params.id, req.companyId);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });
    res.json(shipment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listByPickWave(req, res) {
  try {
    const shipments = await packShipService.listByPickWave(req.companyId, req.params.pickWaveId);
    res.json(shipments);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function pack(req, res) {
  try {
    const shipment = await packShipService.markPacked(req.params.id, req.companyId, req.auth.userId);
    res.json(shipment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function ship(req, res) {
  try {
    const shipment = await packShipService.markShipped(req.params.id, req.companyId, req.auth.userId, req.body);
    res.json(shipment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deliver(req, res) {
  try {
    const shipment = await packShipService.markDelivered(req.params.id, req.companyId, req.body?.podNote);
    res.json(shipment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, get, listByPickWave, pack, ship, deliver };
