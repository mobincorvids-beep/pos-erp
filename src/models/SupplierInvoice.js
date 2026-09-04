const { Schema, model } = require('mongoose');

/**
 * The supplier's own bill for a PO — distinct from the PurchaseOrder (what
 * we ordered) and the GoodsReceivedNote (what physically arrived). Having
 * all three as separate documents is what makes a real three-way match
 * possible: does the invoice agree with what was ordered, and with what
 * was actually received? Before this model, AP/payment ran straight off
 * the PO+GRN with no independent record of what the supplier actually
 * billed, so nothing could ever be compared against anything.
 */
const supplierInvoiceLineSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantityInvoiced: { type: Number, required: true },
  unitPrice: { type: Number, required: true },

  // Filled in by threeWayMatchService.performMatch() — per-line comparison
  // against the PO's ordered qty/price and the sum of GRN quantityReceived
  // for this product/variant on this PO.
  quantityOrdered: { type: Number, default: null },
  quantityReceived: { type: Number, default: null },
  priceOrdered: { type: Number, default: null },
  quantityVariance: { type: Number, default: null }, // quantityInvoiced - quantityReceived
  priceVariance: { type: Number, default: null },     // unitPrice - priceOrdered
  priceVariancePercent: { type: Number, default: null },
  lineMatchStatus: { type: String, default: 'pending', enum: ['pending', 'matched', 'variance'] },
}, { _id: false });

const supplierInvoiceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
  supplierInvoiceNumber: { type: String, required: true }, // the supplier's own reference, not ours
  invoiceDate: { type: Date, default: Date.now },
  items: { type: [supplierInvoiceLineSchema], default: [] },
  totalAmount: { type: Number, required: true },

  matchStatus: {
    type: String,
    default: 'pending',
    enum: ['pending', 'matched', 'variance', 'approved', 'rejected'],
  },
  toleranceMode: { type: String, default: 'percent', enum: ['percent', 'amount'] },
  tolerancePercent: { type: Number, default: 2 }, // a price differing by <= this % still counts as "matched"
  toleranceAmount: { type: Number, default: 0 },
  matchedAt: { type: Date, default: null },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
}, { timestamps: true });

supplierInvoiceSchema.index({ companyId: 1, supplierId: 1, supplierInvoiceNumber: 1 }, { unique: true });

module.exports = model('SupplierInvoice', supplierInvoiceSchema);
