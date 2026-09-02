const { Schema, model } = require('mongoose');

// Per-warehouse replenishment override. Product.reorderLevel (global, one
// number per product across every warehouse) still exists and stays the
// fallback for a warehouse with no rule of its own — a product often needs
// a different reorder point at a busy retail branch than at a slow-moving
// backroom warehouse, and this is the layer that lets that differ without
// touching the product-level default other flows (low-stock notifications,
// MRP's includeReorderLevel demand) already read.
const reorderRuleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  minQty: { type: Number, required: true, default: 0 }, // reorder point for this warehouse — at/below this, the product is "below reorder point" here
  maxQty: { type: Number, default: null }, // optional target/reorder-up-to quantity; falls back to 2x minQty when absent, same convention aiInsightsService already uses for reorderLevel
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

reorderRuleSchema.index({ warehouseId: 1, productId: 1 }, { unique: true });

module.exports = model('ReorderRule', reorderRuleSchema);
