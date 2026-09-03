const Shipment = require('../models/CoreShipment');
const ProofOfDelivery = require('../models/ProofOfDelivery');
const logisticsService = require('../services/logisticsService');

async function list(req, res) {
  const shipments = await logisticsService.listShipments(req.companyId, {
    status: req.query.status,
    branchId: req.query.branchId,
    saleId: req.query.saleId,
    customerId: req.query.customerId,
    trackingNumber: req.query.trackingNumber,
  });
  res.json(shipments);
}

async function getOne(req, res) {
  const shipment = await Shipment.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
  if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
  const timeline = await logisticsService.shipmentTimeline(shipment._id);
  res.json({ shipment, timeline });
}

async function create(req, res) {
  const shipment = await logisticsService.createShipment(req.companyId, {
    branchId: req.body.branchId || req.user?.branchId || null,
    saleId: req.body.saleId || null,
    customerId: req.body.customerId || null,
    origin: req.body.origin,
    destination: req.body.destination,
    carrierName: req.body.carrierName,
    trackingNumber: req.body.trackingNumber,
    weight: req.body.weight,
    dimensions: req.body.dimensions,
    shippingCost: req.body.shippingCost,
    assignedDriverId: req.body.assignedDriverId || null,
    assignedVehicleId: req.body.assignedVehicleId || null,
  });
  res.status(201).json(shipment);
}

async function updateStatus(req, res) {
  const shipment = await Shipment.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
  const updated = await logisticsService.updateStatus(req.params.id, req.body.status, req.body.note, req.body.location);
  res.json(updated);
}

async function assign(req, res) {
  const shipment = await Shipment.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
  const updated = await logisticsService.assignCarrierOrDriver(req.params.id, req.body);
  res.json(updated);
}

async function deliver(req, res) {
  const shipment = await Shipment.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
  // recordDelivery() now also captures a structured ProofOfDelivery when
  // recipientName is supplied — see src/models/ProofOfDelivery.js. Response
  // shape changed from the bare shipment to { shipment, proofOfDelivery }
  // to carry that back; podNote-only callers still work exactly as before,
  // just reading `.shipment` off the response now instead of the body root.
  const result = await logisticsService.recordDelivery(req.params.id, {
    podNote: req.body.podNote,
    recipientName: req.body.recipientName,
    signatureImageBase64: req.body.signatureImageBase64,
    photoBase64: req.body.photoBase64,
    gpsLat: req.body.gpsLat, gpsLng: req.body.gpsLng,
    notes: req.body.notes, capturedBy: req.auth?.userId,
  });
  res.json(result);
}

async function timeline(req, res) {
  const shipment = await Shipment.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
  if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
  const events = await logisticsService.shipmentTimeline(req.params.id);
  res.json(events);
}

async function track(req, res) {
  const result = await logisticsService.trackByNumber(req.companyId, req.params.trackingNumber);
  if (!result) return res.status(404).json({ message: 'Shipment not found.' });
  res.json(result);
}

async function proofOfDelivery(req, res) {
  const shipment = await Shipment.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
  if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
  const records = await ProofOfDelivery.find({ companyId: req.companyId, shipmentId: req.params.id }).sort({ createdAt: -1 });
  res.json(records);
}

module.exports = { list, getOne, create, updateStatus, assign, deliver, timeline, track, proofOfDelivery };
