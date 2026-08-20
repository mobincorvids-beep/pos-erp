const { Schema, model } = require('mongoose');

const stockTransferItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', default: null },
  quantity: { type: Number, required: true },
}, { _id: false });

const stockTransferSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  fromWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  toWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  status: { type: String, default: 'pending' }, // pending, in_transit, received
  items: [stockTransferItemSchema],
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('StockTransfer', stockTransferSchema);
