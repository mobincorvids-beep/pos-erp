const Shipment = require('../models/CoreShipment');
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
  const updated = await logisticsService.recordDelivery(req.params.id, { podNote: req.body.podNote });
  res.json(updated);
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

module.exports = { list, getOne, create, updateStatus, assign, deliver, timeline, track };
