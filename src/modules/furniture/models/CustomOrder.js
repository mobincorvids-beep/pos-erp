const { Schema, model } = require('mongoose');

// A made-to-order piece — mostly an interlink hub, not a new mechanic on
// its own: the deposit reuses the exact Dr-Cash/Cr-Liability pattern
// Hotel and Banquet already established, and production is a REAL core
// Manufacturing WorkOrder (bomId + workOrderId below), not a duplicate
// production concept. What's genuinely new is what gets tracked once the
// order is delivered — promisedDeliveryDate vs. actualDeliveryDate, an
// on-time/late fulfillment metric nothing else in this app computes.
const customOrderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  description: String,
  bomId: { type: Schema.Types.ObjectId, ref: 'BillOfMaterials', default: null }, // set once production starts
  workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', default: null }, // the REAL core production record
  promisedDeliveryDate: { type: Date, required: true },
  actualDeliveryDate: { type: Date, default: null },
  price: { type: Number, required: true },
  depositAmount: { type: Number, default: 0 },
  depositReceivedInAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  depositLiabilityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  status: { type: String, default: 'ordered', enum: ['ordered', 'in_production', 'ready', 'delivered', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

module.exports = model('CustomOrder', customOrderSchema);
