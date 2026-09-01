const { Schema, model } = require('mongoose');

/**
 * Append-only tracking timeline for a Shipment (src/models/Shipment.js).
 * Never updated or deleted once written — logisticsService.updateStatus
 * always inserts a new event rather than mutating an old one, so the
 * timeline stays a faithful audit trail of what happened and when.
 */
const shipmentEventSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  shipmentId: { type: Schema.Types.ObjectId, ref: 'CoreShipment', required: true, index: true },
  status: { type: String, required: true },
  note: { type: String, default: '' },
  location: { type: String, default: '' },
}, { timestamps: true });

shipmentEventSchema.index({ companyId: 1, shipmentId: 1, createdAt: 1 });

module.exports = model('ShipmentEvent', shipmentEventSchema);
