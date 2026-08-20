const { Schema, model } = require('mongoose');

const stockLevelSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', default: null },
  quantity: { type: Number, default: 0 },
  // Weighted-average cost per unit, recomputed on every 'purchase'/'production_output'
  // movement. Used for stock valuation and COGS instead of falling back to
  // the product's static costPrice.
  avgCost: { type: Number, default: 0 },
  // Committed to open Sales Orders that haven't been invoiced yet — reduces
  // what's actually sellable without reducing on-hand quantity (goods are
  // still physically there, just spoken for). See "Reserved stock" in the
  // proposal's inventory list.
  reservedQuantity: { type: Number, default: 0 },
}, { timestamps: true });

stockLevelSchema.index(
  { warehouseId: 1, variantId: 1, batchId: 1 },
  { unique: true }
);

module.exports = model('StockLevel', stockLevelSchema);
