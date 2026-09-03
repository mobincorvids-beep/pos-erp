/**
 * PackShipService — links a completed PickWave to a pack/ship/deliver
 * workflow. This is a thin layer on top of the existing CoreShipment /
 * logisticsService (src/services/logisticsService.js): createFromPickWave
 * calls logisticsService.createShipment (just adding pickWaveId), and
 * every status move calls logisticsService.updateStatus, which already
 * owns the transition table, the ShipmentEvent audit trail, and the
 * deliveredAt bookkeeping — none of that is duplicated here.
 */
const PickWave = require('../models/PickWave');
const CoreShipment = require('../models/CoreShipment');
const logisticsService = require('../services/logisticsService');

/** Creates a shipment for a completed pick wave. One pick wave can have more than one shipment (e.g. split-shipped). */
async function createFromPickWave({ companyId, pickWaveId, branchId, saleId, customerId, destination, carrierName, trackingNumber, weight, dimensions, shippingCost }) {
  const wave = await PickWave.findOne({ _id: pickWaveId, companyId });
  if (!wave) throw new Error('Pick wave not found.');
  if (wave.status !== 'completed') {
    throw new Error(`Cannot create a shipment from a pick wave with status "${wave.status}" — it must be completed first.`);
  }

  const shipment = await logisticsService.createShipment(companyId, {
    branchId: branchId || null,
    saleId: saleId || (wave.saleIds && wave.saleIds[0]) || null,
    customerId: customerId || null,
    destination,
    carrierName,
    trackingNumber,
    weight,
    dimensions,
    shippingCost,
  });

  shipment.pickWaveId = wave._id;
  await shipment.save();
  return shipment;
}

async function markPacked(shipmentId, companyId, userId) {
  const shipment = await CoreShipment.findOne({ _id: shipmentId, companyId });
  if (!shipment) throw new Error('Shipment not found.');

  const updated = await logisticsService.updateStatus(shipmentId, 'packed', 'Packed', '');
  updated.packedBy = userId;
  updated.packedAt = new Date();
  await updated.save();
  return updated;
}

async function markShipped(shipmentId, companyId, userId, { carrierName, trackingNumber } = {}) {
  const shipment = await CoreShipment.findOne({ _id: shipmentId, companyId });
  if (!shipment) throw new Error('Shipment not found.');

  if (carrierName !== undefined || trackingNumber !== undefined) {
    await logisticsService.assignCarrierOrDriver(shipmentId, { carrierName, trackingNumber });
  }

  const updated = await logisticsService.updateStatus(shipmentId, 'shipped', 'Shipped', '');
  updated.shippedBy = userId;
  updated.shippedAt = new Date();
  await updated.save();
  return updated;
}

/** 'Delivered' reuses logisticsService.recordDelivery verbatim — no separate delivery bookkeeping here. */
async function markDelivered(shipmentId, companyId, podNote) {
  const shipment = await CoreShipment.findOne({ _id: shipmentId, companyId });
  if (!shipment) throw new Error('Shipment not found.');
  return logisticsService.recordDelivery(shipmentId, { podNote });
}

async function listByPickWave(companyId, pickWaveId) {
  return CoreShipment.find({ companyId, pickWaveId }).sort({ createdAt: -1 });
}

async function getShipment(shipmentId, companyId) {
  return CoreShipment.findOne({ _id: shipmentId, companyId });
}

module.exports = { createFromPickWave, markPacked, markShipped, markDelivered, listByPickWave, getShipment };
