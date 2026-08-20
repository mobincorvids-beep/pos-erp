const { Schema, model } = require('mongoose');

const stockMovementSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', default: null },

  // sale, purchase, transfer_in, transfer_out, adjustment,
  // production_consume, production_output
  type: { type: String, required: true },

  quantity: { type: Number, required: true }, // +ve = stock in, -ve = stock out
  unitCost: Number,

  referenceType: String, // 'Sale', 'PurchaseOrder', 'StockTransfer', ...
  referenceId: Schema.Types.ObjectId,

  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  note: String,
}, { timestamps: true });

stockMovementSchema.index({ referenceType: 1, referenceId: 1 });

module.exports = model('StockMovement', stockMovementSchema);
