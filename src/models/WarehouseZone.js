const { Schema, model } = require('mongoose');

/**
 * A zone groups bins within a warehouse by function (receiving dock,
 * bulk storage, pick face, packing bench, shipping staging, etc.). Purely
 * an organizational layer on top of Warehouse — does not itself hold
 * stock quantities (see WarehouseBin / BinStock for that).
 */
const warehouseZoneSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  name: { type: String, required: true },
  code: { type: String },
  type: { type: String, enum: ['receiving', 'storage', 'picking', 'packing', 'shipping', 'other'], default: 'storage' },
}, { timestamps: true });

module.exports = model('WarehouseZone', warehouseZoneSchema);
