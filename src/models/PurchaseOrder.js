const { Schema, model } = require('mongoose');

const poItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantityOrdered: { type: Number, required: true },
  quantityReceived: { type: Number, default: 0 },
  unitCost: { type: Number, required: true },
}, { timestamps: true });

// Extra costs incurred on the PO as a whole (freight/shipping, customs duty,
// insurance, handling fees, ...) that don't belong to any single line item
// but still form part of the TRUE per-unit cost of the goods for COGS /
// inventory valuation. Each entry is allocated across the PO's line items
// independently by its own allocationMethod (see
// purchaseService.computeLandedCostAllocation), then summed per line — so a
// PO with freight allocated by value and a customs duty allocated by
// quantity is handled correctly rather than forcing one method for
// everything. An empty array (the default) allocates nothing: existing
// behaviour for every PO created before this feature is completely
// unaffected.
const landedCostSchema = new Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  allocationMethod: { type: String, enum: ['by_value', 'by_quantity'], default: 'by_value' },
}, { timestamps: true });

const purchaseOrderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  requisitionId: { type: Schema.Types.ObjectId, ref: 'PurchaseRequisition', default: null },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null }, // tags this PO for job costing; a ProjectCost is auto-created per GRN received against it
  poNumber: { type: String, required: true, unique: true },
  // Business date of the order — AP aging and early-payment-discount
  // terms measure from THIS, not from the immutable createdAt stamp, so
  // a PO entered into the system days after it was actually raised ages
  // correctly. Defaults to now: existing behaviour is unchanged.
  orderDate: { type: Date, default: Date.now },
  status: { type: String, default: 'draft' }, // draft, ordered, partially_received, received, cancelled
  items: [poItemSchema],
  landedCosts: [landedCostSchema],
  subtotal: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 }, // set to totalAmount once received; reduced by SupplierPayment allocations
  // Real "2/10 net 30"-style trade credit terms — all optional and
  // default to null/0, so every existing PurchaseOrder and every prior
  // call to recordPayment() is completely unaffected. Set once, at PO
  // creation time; earlyPaymentDiscountService reads these to decide
  // whether a given payment date genuinely qualifies for the discount.
  paymentTermsDays: { type: Number, default: null },
  earlyPaymentDiscountPercent: { type: Number, default: 0 },
  earlyPaymentDiscountDays: { type: Number, default: 0 },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('PurchaseOrder', purchaseOrderSchema);
