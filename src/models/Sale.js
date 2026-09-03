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

  // Drop-shipping — set when this sales-order line is fulfilled directly
  // by a supplier shipping to the customer (see PurchaseOrder.isDropShip)
  // instead of from this company's own warehouse stock. Left null/false
  // for every ordinary line, so existing Sale documents and every prior
  // reader of `items` are unaffected. Populated by purchaseService.
  // receiveGoods() when receiving against the linked drop-ship PO line —
  // NOT by convertToInvoice(), which is skipped entirely for a fulfilled
  // drop-ship line (there's no local stock to deduct).
  dropShipFulfilled: { type: Boolean, default: false },
  dropShipPurchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  dropShipFulfilledAt: { type: Date, default: null },
}, { _id: false });

// Pakistani retail/wholesale market: mobile wallets and informal credit
// instruments dominate alongside cash/card. Left as a free String on the
// schema (not a hard mongoose enum, matching what was already there) so an
// unlisted legacy value never fails validation — SALE_PAYMENT_METHODS is
// the documented set every caller (checkout UI, reports) should use.
const SALE_PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'jazzcash', 'easypaisa', 'cheque', 'cod', 'credit', 'split'];

const salePaymentSchema = new Schema({
  paymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
  method: { type: String, required: true }, // cash, card, bank_transfer, jazzcash, easypaisa, cheque, cod, credit, split
  amount: { type: Number, required: true },
  // Set for method 'jazzcash'/'easypaisa' (PaymentGatewayTransaction._id or
  // providerTransactionId) and for method 'cheque' (Cheque._id), so a
  // sale's payment line can be traced back to the record that backs it.
  reference: { type: String, default: null },
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
  // The business date the document is dated for — aging, statements and
  // any "how old is this receivable" question measure from THIS, never
  // from createdAt. Mongoose marks timestamps.createdAt immutable, so a
  // record-creation timestamp can never be corrected or backdated for a
  // sale entered late; an explicit invoice date can. Defaults to now, so
  // every existing call site behaves exactly as before.
  invoiceDate: { type: Date, default: Date.now },
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

  // Customer-facing delivery estimate for a sales order, optional/nullable
  // — most existing sales (POS, quotations) never set it, so every prior
  // document and call site is unaffected. Read by
  // salesOrderService.getPublicOrderStatus() for order-tracking lookups.
  expectedDeliveryDate: { type: Date, default: null },

  items: [saleItemSchema],
  payments: [salePaymentSchema],

  subtotal: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  // A coupon applied at checkout, on top of the per-line discounts already
  // folded into discountAmount above. Sale has no other header-level
  // discount field (see loyaltyService's header comment on why point
  // redemption goes through items[].discountAmount instead) — a coupon
  // is a straight subtraction from totalAmount, snapshotted here so the
  // invoice can show what was applied without re-deriving it from Coupon later.
  couponCode: { type: String, default: null },
  couponDiscountAmount: { type: Number, default: 0 },
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
  // Set on every failed fbrService.submitInvoice() attempt and cleared on
  // success — the retry cron (jobs/fbrRetryCron.js) and the manual "Retry
  // FBR submission" button both key off this being non-null.
  fbrSubmissionError: { type: String, default: null },
  // Timestamp of the most recent submitInvoice() attempt (success or
  // failure). The retry cron backs off fbrService.RETRY_BACKOFF_MS from
  // this before trying the same sale again.
  fbrLastAttemptAt: { type: Date, default: null },

  // Provincial services-tax authorities (SRB/PRA/KPRA/BRA) — a company can
  // be registered with more than one (e.g. FBR federally for goods, SRB
  // provincially for services), so this is an array, one entry per
  // authority actually submitted to. See taxComplianceService.
  taxSubmissions: [{
    authority: { type: String, enum: ['srb', 'pra', 'kpra', 'bra'] },
    referenceNumber: String,
    submittedAt: Date,
  }],

  // Cash-on-delivery: distributors/wholesalers shipping to retail stores
  // invoice at dispatch but only actually collect cash when the delivery
  // driver hands over the goods, which can be hours or days after the Sale
  // document is created. isCOD flags that this sale's tender is collected
  // on delivery rather than at the counter; codCollectedAt stays null until
  // a driver/cashier confirms the cash was actually received (see
  // posSaleService.markCodCollected). Deliberately independent of
  // dueAmount/paidAmount — a COD sale can still be posted as due/unpaid at
  // checkout time and only marked collected later, without pretending it
  // was a normal credit sale.
  isCOD: { type: Boolean, default: false },
  codCollectedAt: { type: Date, default: null },
  codCollectedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  // Order holds — credit/fraud/manual review. 'none' is the default and
  // covers every existing document unchanged. A held sales_order should not
  // proceed to fulfillment/picking/conversion-to-invoice until released via
  // orderHoldService.releaseOrderHold — see salesOrderService.convertToInvoice's
  // hold check. Additive: nothing that doesn't call the new hold logic is
  // affected.
  holdStatus: { type: String, default: 'none', enum: ['none', 'credit_hold', 'fraud_review', 'manual_hold'] },
  holdReason: { type: String, default: null },
  heldBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  heldAt: { type: Date, default: null },
  releasedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  releasedAt: { type: Date, default: null },

  // Order splitting (see salesOrderService.splitOrder) — set on the NEW
  // document created by a split, pointing back at the order it was split
  // from, e.g. for partial-warehouse-fulfillment.
  splitFromOrderId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

saleSchema.statics.PAYMENT_METHODS = SALE_PAYMENT_METHODS;

module.exports = model('Sale', saleSchema);
