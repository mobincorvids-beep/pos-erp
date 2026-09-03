const { Schema, model } = require('mongoose');

/**
 * BinTransfer — a proper request/approve/complete workflow around bin-to-bin
 * stock moves, layered on top of warehouseZoneService.moveBinStock() the
 * same way StockTransfer layers a documented workflow on top of
 * inventoryService.recordMovement(). moveBinStock() itself is NOT
 * duplicated here — completeBinTransfer() calls it directly so the
 * location-quantity math (and its "not enough stock in the source bin"
 * guard) stays in exactly one place.
 *
 * Two approval gates rather than one (request -> approve -> complete)
 * because in a real warehouse the person who WANTS bins reorganized isn't
 * always the person authorized to move stock, and the move itself may not
 * happen the instant it's approved (a picker has to physically walk the
 * floor) — same reasoning as StockTransfer's initiate/receive split.
 */
const binTransferSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  fromBinId: { type: Schema.Types.ObjectId, ref: 'WarehouseBin', required: true },
  toBinId: { type: Schema.Types.ObjectId, ref: 'WarehouseBin', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, default: null },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', default: null },
  quantity: { type: Number, required: true },

  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'approved', 'completed', 'rejected'],
  },

  // --- Audit trail ---
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requestedAt: { type: Date, default: Date.now },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  completedAt: { type: Date, default: null },
  rejectedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },

  note: { type: String, default: null },
}, { timestamps: true });

module.exports = model('BinTransfer', binTransferSchema);
