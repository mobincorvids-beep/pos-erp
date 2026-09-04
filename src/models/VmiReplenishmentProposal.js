const { Schema, model } = require('mongoose');

/**
 * VmiReplenishmentProposal — a supplier's own suggestion (via the supplier
 * portal) to top up their VMI-covered product back toward maxQty, sitting
 * between "supplier saw a low-stock signal" and "a real PurchaseOrder
 * exists". Staff review/convert it (vmiService.convertProposalToPO) unless
 * the agreement is autoApprove, in which case it's created already
 * 'approved' and immediately converted.
 */
const vmiReplenishmentProposalSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  agreementId: { type: Schema.Types.ObjectId, ref: 'VmiAgreement', required: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, default: null },
  onHandAtProposal: { type: Number, required: true }, // stock level that triggered/justified this proposal, snapshotted
  proposedQty: { type: Number, required: true, min: 1 },
  unitCost: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'converted'], default: 'pending' },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null }, // set once converted
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  note: String,
}, { timestamps: true });

module.exports = model('VmiReplenishmentProposal', vmiReplenishmentProposalSchema);
