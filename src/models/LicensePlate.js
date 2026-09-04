const { Schema, model } = require('mongoose');

/**
 * A license plate / pallet: one movable physical unit that can carry
 * several products (and quantities) at once, so a forklift operator moves
 * ONE thing between bins instead of the system tracking each product-in-bin
 * row independently. This sits alongside BinStock rather than replacing it
 * — moving a license plate moves every BinStock row for its contents in
 * lockstep (see licensePlateService.moveLicensePlate), so "where is this
 * pallet" and "how much of this SKU is in this bin" both stay correct from
 * the same action instead of needing N separate bin-transfer calls.
 */
const licensePlateContentSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, default: null },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', default: null },
  quantity: { type: Number, required: true, min: 0 },
}, { _id: true });

const licensePlateSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  code: { type: String, required: true }, // scannable LP/pallet label, e.g. "LP-000123"
  binId: { type: Schema.Types.ObjectId, ref: 'WarehouseBin', default: null }, // current location, null once shipped/consumed
  status: { type: String, default: 'open', enum: ['open', 'closed', 'shipped', 'consumed'] },
  contents: { type: [licensePlateContentSchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  closedAt: { type: Date, default: null },
  shippedAt: { type: Date, default: null },
}, { timestamps: true });

licensePlateSchema.index({ companyId: 1, warehouseId: 1, code: 1 }, { unique: true });
licensePlateSchema.index({ companyId: 1, status: 1 });

module.exports = model('LicensePlate', licensePlateSchema);
