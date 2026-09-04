const { Schema, model } = require('mongoose');

/**
 * VmiAgreement — Vendor-Managed Inventory: this supplier has agreed to
 * watch OUR stock level for this product at this warehouse and keep it
 * between minQty/maxQty, instead of us raising POs against them ourselves.
 * One row per (companyId, supplierId, warehouseId, productId). The supplier
 * sees live stock/consumption for exactly the products covered here (via
 * the supplier portal, /supplier-portal-session/vmi/*) and can propose a
 * replenishment order; staff review/convert proposals into a real PO —
 * see vmiService.proposeReplenishment / convertProposalToPO. autoApprove
 * lets a trusted supplier's proposal skip the staff-review step entirely
 * and become an ordered PO immediately; defaults to false so every
 * agreement starts requiring a human look.
 */
const vmiAgreementSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  variantId: { type: Schema.Types.ObjectId, default: null }, // null = the product's default/only variant
  minQty: { type: Number, required: true, min: 0 },
  maxQty: { type: Number, required: true, min: 0 },
  unitCost: { type: Number, required: true, min: 0 }, // agreed replenishment price — snapshotted onto any PO this agreement generates
  autoApprove: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

vmiAgreementSchema.index({ companyId: 1, supplierId: 1, warehouseId: 1, productId: 1, variantId: 1 }, { unique: true });

module.exports = model('VmiAgreement', vmiAgreementSchema);
