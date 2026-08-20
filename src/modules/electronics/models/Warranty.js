const { Schema, model } = require('mongoose');

// One warranty period tied to a specific physical unit — deliberately
// keyed by serialNumber, not just a product, since "under warranty" is a
// question about ONE unit a customer owns, not the product line in
// general. expiryDate is stored (computed once at registration from
// startDate + warrantyMonths), not recalculated on every read — the same
// "store the computed threshold, don't recompute it every query" choice
// Service Station made for nextServiceDueDate, for the same reason: a
// real indexed query beats loading every warranty into JS to check.
const warrantySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  serialNumber: { type: String, required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale' },
  warrantyMonths: { type: Number, required: true },
  startDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
}, { timestamps: true });

warrantySchema.index({ companyId: 1, serialNumber: 1 }, { unique: true });

module.exports = model('Warranty', warrantySchema);
