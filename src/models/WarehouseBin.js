const { Schema, model } = require('mongoose');

/**
 * A physical/logical storage location within a warehouse (a shelf, rack
 * slot, or pallet position), optionally grouped under a WarehouseZone.
 * Bins are where BinStock records point to for the per-location breakdown
 * of a product's on-hand quantity.
 */
const warehouseBinSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  zoneId: { type: Schema.Types.ObjectId, ref: 'WarehouseZone', default: null },
  binCode: { type: String, required: true },
  capacity: { type: Number, default: null }, // optional max units this bin can hold
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

warehouseBinSchema.index({ companyId: 1, warehouseId: 1, binCode: 1 }, { unique: true });

module.exports = model('WarehouseBin', warehouseBinSchema);
