const { Schema, model } = require('mongoose');

const ledgerEntrySchema = new Schema({
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  // Optional — every one of the hundreds of existing postVoucher() call
  // sites across every industry module simply doesn't pass this, and
  // nothing about them changes: the balance validator below only sums
  // debit/credit, genuinely unaffected by this field's presence or absence.
  costCenterId: { type: Schema.Types.ObjectId, ref: 'CostCenter', default: null },
}, { _id: false });

const voucherSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  voucherNumber: { type: String, required: true, unique: true },
  type: { type: String, required: true }, // journal, payment, receipt, contra
  date: { type: Date, required: true },
  narration: String,
  referenceType: String, // 'Sale', 'PurchaseOrder', 'Expense', ...
  referenceId: Schema.Types.ObjectId,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  // Reversal tracking — a reversed voucher stays in the ledger (never
  // deleted/edited, preserving the audit trail) but is flagged, and points
  // at the new voucher that cancels it out.
  reversedByVoucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
  reversesVoucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
  reversedAt: { type: Date, default: null },
  entries: {
    type: [ledgerEntrySchema],
    validate: {
      validator(entries) {
        const debit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const credit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
        return Math.abs(debit - credit) < 0.01; // double-entry must balance
      },
      message: 'Voucher entries must balance: total debit must equal total credit.',
    },
  },
}, { timestamps: true });

module.exports = model('Voucher', voucherSchema);
