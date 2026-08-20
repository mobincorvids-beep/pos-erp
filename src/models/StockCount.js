const { Schema, model } = require('mongoose');

const stockCountItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', default: null },
  systemQuantity: { type: Number, required: true }, // snapshotted from StockLevel when the count was started
  countedQuantity: { type: Number, default: null },  // filled in as staff count, null until counted
}, { _id: true });

// A physical stocktake. Started with a snapshot of what the system thinks is
// on hand; submitted with what was actually counted. The variance between
// them becomes 'adjustment' stock movements — this is the ONLY sanctioned
// way stock quantities get corrected outside of a real transaction (sale,
// purchase, transfer), so every correction is still ledger-traceable.
const stockCountSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  countNumber: { type: String, required: true, unique: true },
  items: [stockCountItemSchema],
  status: { type: String, default: 'in_progress', enum: ['in_progress', 'submitted'] },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  submittedAt: Date,
}, { timestamps: true });

module.exports = model('StockCount', stockCountSchema);
