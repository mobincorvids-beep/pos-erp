const Shipment = require('../models/CoreShipment');
const ShipmentEvent = require('../models/ShipmentEvent');
const { nextDocumentNumber } = require('./numberingService');

// Sane forward status transitions. 'failed' and 'returned' are reachable
// from most active states (a delivery attempt can fail from anywhere
// after pickup), so they're treated as always-allowed exits rather than
// enumerated per-state. 'delivered' is terminal — once delivered a
// shipment does not move again except via a fresh return flow, which is
// out of scope here (a returned shipment is its own status, not a
// re-opening of the delivered one).
const FORWARD_TRANSITIONS = {
  pending: ['picked_up', 'failed'],
  picked_up: ['in_transit', 'failed', 'returned'],
  in_transit: ['out_for_delivery', 'failed', 'returned'],
  out_for_delivery: ['delivered', 'failed', 'returned'],
  delivered: [],
  failed: ['picked_up', 'in_transit', 'returned'], // a failed attempt can be retried
  returned: [],
};

function assertValidTransition(from, to) {
  if (!Shipment.STATUSES.includes(to)) {
    throw new Error(`Invalid shipment status: ${to}`);
  }
  if (from === to) return; // idempotent no-op re-post (e.g. duplicate webhook) is fine
  const allowed = FORWARD_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot transition shipment from '${from}' to '${to}'`);
  }
}

async function createShipment(companyId, data) {
  const shipmentNumber = data.shipmentNumber || nextDocumentNumber('SHP');
  const shipment = await Shipment.create({
    ...data,
    companyId,
    shipmentNumber,
    status: data.status || 'pending',
  });
  await ShipmentEvent.create({
    companyId,
    shipmentId: shipment._id,
    status: shipment.status,
    note: 'Shipment created',
  });
  return shipment;
}

async function updateStatus(shipmentId, status, note = '', location = '') {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new Error('Shipment not found.');

  assertValidTransition(shipment.status, status);

  shipment.status = status;
  if (status === 'delivered' && !shipment.deliveredAt) {
    shipment.deliveredAt = new Date();
  }
  await shipment.save();

  await ShipmentEvent.create({
    companyId: shipment.companyId,
    shipmentId: shipment._id,
    status,
    note,
    location,
  });

  return shipment;
}

async function assignCarrierOrDriver(shipmentId, { carrierName, trackingNumber, assignedDriverId, assignedVehicleId } = {}) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new Error('Shipment not found.');

  if (carrierName !== undefined) shipment.carrierName = carrierName;
  if (trackingNumber !== undefined) shipment.trackingNumber = trackingNumber;
  if (assignedDriverId !== undefined) shipment.assignedDriverId = assignedDriverId || null;
  if (assignedVehicleId !== undefined) shipment.assignedVehicleId = assignedVehicleId || null;

  await shipment.save();

  await ShipmentEvent.create({
    companyId: shipment.companyId,
    shipmentId: shipment._id,
    status: shipment.status,
    note: 'Carrier/driver/vehicle assignment updated',
  });

  return shipment;
}

async function recordDelivery(shipmentId, { podNote = '' } = {}) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new Error('Shipment not found.');

  assertValidTransition(shipment.status, 'delivered');

  shipment.status = 'delivered';
  shipment.podNote = podNote;
  shipment.deliveredAt = new Date();
  await shipment.save();

  await ShipmentEvent.create({
    companyId: shipment.companyId,
    shipmentId: shipment._id,
    status: 'delivered',
    note: podNote ? `Delivered: POD: ${podNote}` : 'Delivered',
  });

  return shipment;
}

async function listShipments(companyId, filters = {}) {
  const query = { companyId };
  if (filters.status) query.status = filters.status;
  if (filters.branchId) query.branchId = filters.branchId;
  if (filters.saleId) query.saleId = filters.saleId;
  if (filters.customerId) query.customerId = filters.customerId;
  if (filters.trackingNumber) query.trackingNumber = filters.trackingNumber;

  return Shipment.find(query).sort({ createdAt: -1 }).lean();
}

async function shipmentTimeline(shipmentId) {
  return ShipmentEvent.find({ shipmentId }).sort({ createdAt: 1 }).lean();
}

// Implemented as a normal authenticated read (per task instructions) —
// callers still pass companyId, scoping the lookup to their own tenant.
// No unauthenticated route is built for this; see routes file for the one
// deliberate public exception (GET /:companyId/track/:trackingNumber).
async function trackByNumber(companyId, trackingNumber) {
  const shipment = await Shipment.findOne({ companyId, trackingNumber }).lean();
  if (!shipment) return null;
  const timeline = await shipmentTimeline(shipment._id);
  return { shipment, timeline };
}

module.exports = {
  FORWARD_TRANSITIONS,
  createShipment,
  updateStatus,
  assignCarrierOrDriver,
  recordDelivery,
  listShipments,
  shipmentTimeline,
  trackByNumber,
};
