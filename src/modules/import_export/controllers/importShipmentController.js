const importShipmentService = require('../services/importShipmentService');

async function createShipment(req, res) {
  try { res.status(201).json(await importShipmentService.createShipment({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listShipments(req, res) { res.json(await importShipmentService.listShipments(req.companyId, req.query)); }
async function receiveShipment(req, res) {
  try { res.json(await importShipmentService.receiveShipment(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function updateShipment(req, res) {
  try { res.json(await importShipmentService.updateShipment(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function cancelShipment(req, res) {
  const shipment = await importShipmentService.cancelShipment(req.params.id);
  if (!shipment) return res.status(400).json({ error: 'Shipment not found or already received — only a pending shipment can be cancelled.' });
  res.json({ ok: true });
}
module.exports = { createShipment, listShipments, receiveShipment, updateShipment, cancelShipment };
