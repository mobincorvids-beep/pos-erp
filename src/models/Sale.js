const { Schema, model } = require('mongoose');

const saleItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', default: null },
  // For serial/IMEI-tracked products: exactly which physical units this
  // line sold — length must equal quantity. Stored here (not just on
  // ProductSerial) so a return/void can look up "which serials were on
  // this sale" without a separate query, mirroring how GRN lines store
  // their own serialNumbers for the same reason.
  serialNumbers: [{ type: String }],
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  lineTotal: { type: Number, required: true },
}, { _id: false });

const salePaymentSchema = new Schema({
  paymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
  method: { type: String, required: true }, // cash, card, bank_transfer, credit, split
  amount: { type: Number, required: true },
}, { _id: false });

const saleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  posTerminalId: { type: Schema.Types.ObjectId, ref: 'PosTerminal' },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null }, // revenue for this sale counts toward project profitability
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // cashier

  // documentNumber is assigned immediately regardless of type (QUO-xxx, SO-xxx,
  // or the invoice number for a direct POS sale). invoiceNumber is ONLY set
  // once the document is actually converted/billed — a quotation has no
  // invoice number until someone buys, so it can't be `required` anymore.
  documentNumber: { type: String, required: true, unique: true },
  invoiceNumber: { type: String, unique: true, sparse: true },
  status: { type: String, default: 'completed' }, // quotation, sales_order, completed, cancelled, returned
  saleType: { type: String, default: 'pos' },       // pos, sales_order, quotation
  // Where the order originated — distinct from saleType (a checkout
  // workflow) since an e-commerce order still goes through the exact same
  // posSaleService.checkout() as a counter sale, just with a different source.
  channel: { type: String, default: 'pos', enum: ['pos', 'ecommerce'] },

  // Links a converted document back to where it came from, so you can trace
  // Quotation -> Sales Order -> Invoice the way the proposal's "Complete ERP
  // Flow" describes.
  convertedFromId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  validUntil: { type: Date, default: null }, // quotation expiry

  items: [saleItemSchema],
  payments: [salePaymentSchema],

  subtotal: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  writtenOff: { type: Boolean, default: false }, // once true, dueAmount is permanently 0 — see badDebtService.writeOffReceivable
  writtenOffAt: { type: Date, default: null },

  // Real transaction-level foreign-currency denomination — the actual
  // piece that was missing from Multi-Currency before this: a sale can
  // now genuinely be BILLED in a currency other than the company's base
  // one. currency defaults to the base currency and exchangeRate defaults
  // to 1, so every existing call site that never mentions currency at all
  // (which is every single one before this round) behaves EXACTLY as
  // before — this is additive, not a breaking change. totalAmount and
  // every other monetary field above remain in the company's BASE
  // currency always (that's what accounting/vouchers/reports already
  // assume everywhere else in this app) — foreignTotalAmount is the only
  // field actually denominated in `currency`, snapshotted at the rate
  // used at checkout time, the same "snapshot the terms, don't re-derive
  // them later" convention this app already uses everywhere else.
  currency: { type: String, default: null }, // null = base currency, no conversion involved
  exchangeRate: { type: Number, default: 1 }, // 1 unit of `currency` = this many units of the base currency
  foreignTotalAmount: { type: Number, default: null }, // totalAmount expressed in `currency`, for display/printing on the actual invoice — never used for accounting math

  // FBR digital invoicing — kept as dedicated fields (rather than folded
  // into taxSubmissions below) since FBR predates the multi-authority
  // dispatcher and this is what fbrService.js already reads/writes.
  fbrInvoiceNumber: String,
  fbrQrCode: String,
  fbrSubmittedAt: Date,

  // Provincial services-tax authorities (SRB/PRA/KPRA/BRA) — a company can
  // be registered with more than one (e.g. FBR federally for goods, SRB
  // provincially for services), so this is an array, one entry per
  // authority actually submitted to. See taxComplianceService.
  taxSubmissions: [{
    authority: { type: String, enum: ['srb', 'pra', 'kpra', 'bra'] },
    referenceNumber: String,
    submittedAt: Date,
  }],
}, { timestamps: true });

module.exports = model('Sale', saleSchema);
