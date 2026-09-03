const { Schema, model } = require('mongoose');

// One row per field-sales-rep visit to a shop on their route — the
// lightweight "visit log" that makes daily route coverage trackable
// without a full field-service/dispatch system (that's FieldServiceJob,
// a different concept: scheduled service jobs, not route sales calls).
const customerVisitSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  salesRepId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  visitedAt: { type: Date, default: Date.now },
  outcome: { type: String, default: 'order_placed', enum: ['order_placed', 'no_order', 'closed', 'other'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // linked when outcome is order_placed and an order was actually created
  note: String,
}, { timestamps: true });

customerVisitSchema.index({ companyId: 1, salesRepId: 1, visitedAt: -1 });
customerVisitSchema.index({ companyId: 1, customerId: 1, visitedAt: -1 });

module.exports = model('CustomerVisit', customerVisitSchema);
