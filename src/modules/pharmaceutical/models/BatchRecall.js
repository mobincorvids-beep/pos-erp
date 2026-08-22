const { Schema, model } = require('mongoose');

const affectedCustomerSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  quantitySold: { type: Number, required: true }, // how many units from THIS batch this customer actually received, traced from real Sale records
  quantityReturned: { type: Number, default: 0 },
}, { _id: false });

// A real recall event — genuinely different from Pharmacy's existing
// near-expiry report, which is about TIME passing. A recall is about one
// SPECIFIC batch being found defective regardless of its expiry date, and
// its whole point is tracing WHO ALREADY RECEIVED units of it — a real
// "where did this batch go" query across historical sales that nothing
// else in this app does. `affectedCustomers` is populated once, at
// initiation, by actually querying every past Sale whose items reference
// this batchId — not maintained by hand.
const batchRecallSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  reason: { type: String, required: true },
  initiatedDate: { type: Date, default: Date.now },
  affectedCustomers: [affectedCustomerSchema],
  status: { type: String, default: 'active', enum: ['active', 'closed'] },
}, { timestamps: true });

module.exports = model('BatchRecall', batchRecallSchema);
