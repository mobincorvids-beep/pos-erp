const { Schema, model } = require('mongoose');

const trackingEventSchema = new Schema({
  status: { type: String, required: true },
  location: String,
  note: String,
  at: { type: Date, default: Date.now },
}, { _id: false });

// A package's journey — the genuinely new mechanic: a STRICT, ONE-WAY
// status chain (booked -> picked_up -> in_transit -> out_for_delivery ->
// delivered, or -> failed/returned), where every transition is APPENDED
// to an immutable history log, never overwritten. Every prior status
// workflow in this app (ServiceOrder, Visit, WorkOrder) just holds a
// current status field; this is the first one where the FULL PATH matters
// as much as the current state — a customer tracking a package wants to
// see everywhere it's been, not just where it is now.
const shipmentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  trackingNumber: { type: String, required: true },
  origin: String,
  destination: String,
  weight: Number,
  codAmount: { type: Number, default: 0 }, // cash-on-delivery — collected only at the moment of successful delivery
  status: { type: String, default: 'booked', enum: ['booked', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'] },
  history: [trackingEventSchema],
  proofOfDeliveryNote: String, // who signed, or why it failed
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // the shipping fee itself
}, { timestamps: true });

shipmentSchema.index({ companyId: 1, trackingNumber: 1 }, { unique: true });

module.exports = model('Shipment', shipmentSchema);
