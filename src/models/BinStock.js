const { Schema, model } = require('mongoose');

/**
 * Per-bin breakdown of a product's on-hand stock at a warehouse. This is
 * ADDITIVE to StockLevel (the existing source of truth for how much of a
 * product/variant a warehouse actually holds) — it never replaces or
 * recomputes StockLevel.quantity, it only records WHERE, within the
 * warehouse, a portion of that already-tracked quantity physically sits.
 * A product can have zero BinStock rows and still have real stock (just
 * not yet located to a bin) — see warehouseZoneService for the guardrail
 * that keeps the sum of a product's BinStock at a warehouse from ever
 * exceeding its real StockLevel-derived on-hand quantity there.
 */
const binStockSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  binId: { type: Schema.Types.ObjectId, ref: 'WarehouseBin', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  quantity: { type: Number, default: 0 },
}, { timestamps: true });

binStockSchema.index({ binId: 1, productId: 1 }, { unique: true });

module.exports = model('BinStock', binStockSchema);
