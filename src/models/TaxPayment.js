const { Schema, model } = require('mongoose');

// A record of one period's tax liability being paid online — distinct from
// fbrService/taxComplianceService, which submit SALES INVOICES for
// e-invoicing/reporting. This is the vendor actually sending money to FBR
// (or another authority) for a period's liability, via their own JazzCash
// tax-pay credentials on Company.jazzCashTaxPay — see taxPaymentService
// and jazzCashTaxPayService.
const taxPaymentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  taxAuthority: { type: String, enum: ['fbr', 'srb', 'pra', 'kpra', 'bra'], default: 'fbr' },
  periodLabel: { type: String, required: true }, // e.g. "August 2026" — free text, entered by the vendor's accountant
  amountDue: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'initiated', 'paid', 'failed'], default: 'pending', index: true },
  provider: { type: String, default: 'jazzcash' },
  providerTransactionId: { type: String, default: null, index: true },
  fbrAccountNumber: { type: String, default: null }, // account the funds were sent to, snapshotted at initiation
  initiatedAt: { type: Date, default: null },
  paidAt: { type: Date, default: null },
  failureReason: { type: String, default: null },
  initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = model('TaxPayment', taxPaymentSchema);
