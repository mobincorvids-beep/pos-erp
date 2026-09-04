const { Schema, model } = require('mongoose');

/**
 * Supplier-owned inventory physically held in our warehouse but not paid
 * for (or owed) until it's actually consumed/sold — the defining feature
 * of consignment stock vs an ordinary purchase, where the liability is
 * created the moment goods are received. One row per (supplier, product,
 * variant, warehouse, unitCost) batch received under a consignment PO;
 * qtyOnHand decrements and qtyConsumed increments as the stock actually
 * sells, via consignmentService.consumeConsignmentStock (hooked into
 * inventoryService.recordMovement, same best-effort side-channel pattern
 * as the BinStock sync).
 */
const consignmentStockSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  unitCost: { type: Number, required: true },

  qtyReceived: { type: Number, required: true },
  qtyOnHand: { type: Number, required: true },
  qtyConsumed: { type: Number, default: 0 },

  // Running total of AP liability created for THIS batch as it's consumed
  // (qtyConsumed * unitCost) — settleConsignmentLiability() clears it the
  // same way an ordinary supplier payment clears AP, just scoped to
  // consignment consumption rather than a whole PO.
  liabilityAmount: { type: Number, default: 0 },
  liabilitySettled: { type: Number, default: 0 },

  receivedAt: { type: Date, default: Date.now },
}, { timestamps: true });

consignmentStockSchema.index({ companyId: 1, warehouseId: 1, productId: 1, variantId: 1 });

module.exports = model('ConsignmentStock', consignmentStockSchema);
