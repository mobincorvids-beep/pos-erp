const shipmentService = require('../services/shipmentService');

async function createShipment(req, res) {
  try { res.status(201).json(await shipmentService.createShipment({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listShipments(req, res) { res.json(await shipmentService.listShipments(req.companyId, req.query)); }
async function trackByNumber(req, res) {
  const shipment = await shipmentService.trackByNumber(req.companyId, req.params.trackingNumber);
  if (!shipment) return res.status(404).json({ error: 'No shipment found for that tracking number.' });
  res.json(shipment);
}
async function advanceStatus(req, res) {
  try { res.json(await shipmentService.advanceStatus(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function markDelivered(req, res) {
  try { res.json(await shipmentService.markDelivered(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createShipment, listShipments, trackByNumber, advanceStatus, markDelivered };
