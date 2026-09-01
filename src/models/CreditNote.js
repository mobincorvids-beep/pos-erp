const { Schema, model } = require('mongoose');

// A formal accounting document reducing what a customer owes — the tax/
// audit-compliant instrument, distinct from a SaleReturn (a physical stock
// movement). A credit note can arise FROM a return (see saleReturnId) but
// can equally be issued standalone — a pricing correction, a goodwill
// credit, a billing error — with no stock ever moving. Kept as its own
// model rather than folded into SaleReturn for exactly that reason: not
// every credit note has, or needs, a return behind it.
const creditNoteSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  noteNumber: { type: String, required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  // Optional link to the original invoice this note relates to (e.g. a
  // pricing correction against a specific sale) — not required, since a
  // credit note can stand alone.
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  // Optional link when this note was raised as the accounting side of a
  // physical SaleReturn, rather than through saleReturnService directly.
  saleReturnId: { type: Schema.Types.ObjectId, ref: 'SaleReturn', default: null },
  reason: { type: String, default: '' },
  amount: { type: Number, required: true },
  arAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true }, // Accounts Receivable — credited (reduces what the customer owes)
  revenueAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true }, // Sales Revenue — debited (reverses the original income)
  status: { type: String, default: 'issued', enum: ['issued', 'applied', 'void'] },
  // Set once this note has been applied against a later invoice (e.g. as a
  // discount on the customer's next purchase) — distinct from being
  // refunded in cash, which this model does not track since that path is
  // just a normal payment/refund voucher.
  appliedToSaleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  appliedAt: { type: Date, default: null },
  voidedAt: { type: Date, default: null },
  voidReason: { type: String, default: '' },
  issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

creditNoteSchema.index({ companyId: 1, noteNumber: 1 }, { unique: true });

module.exports = model('CreditNote', creditNoteSchema);
