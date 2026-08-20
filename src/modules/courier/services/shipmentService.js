/**
 * ShipmentService — package tracking with a strict, one-way status chain
 * and an append-only history log. The genuinely new mechanic: every
 * status change is APPENDED as an event, never overwritten — the full
 * path matters, not just the current state. Also enforces real transition
 * rules a naive "just set the status field" implementation wouldn't: you
 * cannot mark something delivered before it's out for delivery, and a
 * terminal state (delivered/returned) can never transition again.
 */
const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const posSaleService = require('../../../services/posSaleService');

// Which statuses are legal to move to FROM each current status — the real
// guard against skipping steps or resurrecting a terminal shipment.
const ALLOWED_TRANSITIONS = {
  booked: ['picked_up', 'failed'],
  picked_up: ['in_transit', 'failed'],
  in_transit: ['out_for_delivery', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  failed: ['in_transit', 'returned'], // a failed delivery attempt can be retried, or the package returned to sender
  delivered: [], // terminal — nothing can happen after delivery
  returned: [], // terminal
};

function createShipment(input) {
  const { companyId, branchId, customerId, trackingNumber, origin, destination, weight, codAmount } = input;
  if (!trackingNumber) throw new Error('trackingNumber is required.');
  return Shipment.create({
    companyId, branchId, customerId, trackingNumber, origin, destination, weight, codAmount: codAmount || 0,
    history: [{ status: 'booked', location: origin }],
  });
}

function listShipments(companyId, { status, customerId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;
  return Shipment.find(filter).populate('customerId', 'name').sort({ createdAt: -1 });
}

function trackByNumber(companyId, trackingNumber) {
  return Shipment.findOne({ companyId, trackingNumber });
}

/**
 * Advances the shipment — validates the transition is actually legal
 * (rejects skipping steps or moving out of a terminal state), then
 * APPENDS to history rather than just overwriting status, so the full
 * journey stays visible forever.
 */
async function advanceStatus(shipmentId, { status, location, note }) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new Error('Shipment not found.');

  const allowed = ALLOWED_TRANSITIONS[shipment.status] || [];
  if (!allowed.includes(status)) {
    throw new Error(`Cannot move from "${shipment.status}" to "${status}" — allowed next steps are: ${allowed.length ? allowed.join(', ') : 'none, this is a terminal state'}.`);
  }

  shipment.status = status;
  shipment.history.push({ status, location, note });
  await shipment.save();
  return shipment;
}

/**
 * Marks delivered — the one transition that also bills the shipping fee
 * (and any COD collected) through the ordinary checkout, since "delivered"
 * is the actual point of revenue recognition for a courier, not booking.
 */
async function markDelivered(shipmentId, { proofOfDeliveryNote, shippingFeeProductId, shippingFeeVariantId, shippingFee, warehouseId, customerId, paymentAccountId, userId }) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new Error('Shipment not found.');

  const allowed = ALLOWED_TRANSITIONS[shipment.status] || [];
  if (!allowed.includes('delivered')) throw new Error(`Cannot mark delivered from status "${shipment.status}" — must be "out_for_delivery" first.`);

  let sale = null;
  if (shippingFeeProductId) {
    sale = await posSaleService.checkout({
      companyId: shipment.companyId, branchId: shipment.branchId, warehouseId,
      customerId: customerId || shipment.customerId, userId,
      items: [{ productId: shippingFeeProductId, variantId: shippingFeeVariantId, quantity: 1, unitPrice: shippingFee || 0 }],
      payments: paymentAccountId ? [{ paymentAccountId, method: 'cash', amount: (shippingFee || 0) + shipment.codAmount }] : [],
    });
  }

  shipment.status = 'delivered';
  shipment.history.push({ status: 'delivered', note: proofOfDeliveryNote });
  shipment.proofOfDeliveryNote = proofOfDeliveryNote;
  if (sale) shipment.saleId = sale._id;
  await shipment.save();
  return { shipment, sale };
}

module.exports = { createShipment, listShipments, trackByNumber, advanceStatus, markDelivered };
