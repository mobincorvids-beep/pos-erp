const { Schema, model } = require('mongoose');

const productSerialSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  serialNumber: { type: String, required: true },
  status: { type: String, default: 'in_stock' }, // in_stock, sold, returned, damaged
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // set when sold, cleared on return/void — see serialInventoryService
}, { timestamps: true });

productSerialSchema.index({ variantId: 1, serialNumber: 1 }, { unique: true });

module.exports = model('ProductSerial', productSerialSchema);
