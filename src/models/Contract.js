const { Schema, model } = require('mongoose');

// A generic, industry-agnostic legal contract/agreement — a supplier
// agreement, a customer contract, a lease, an NDA, an employment or
// service agreement — any formal document with a start/end date that a
// business needs to track through activation, renewal, and expiry.
//
// Deliberately separate from warehouse_3pl's StorageContract, which
// isn't a legal-document concept at all: it's a time-quantity BILLING
// ledger (goods held × days × rate) with no counterparty, no term dates,
// and no renewal/termination lifecycle. This model complements it — a
// 3PL operator could, in principle, track the *legal* storage agreement
// here while StorageContract keeps handling the billing math — but
// nothing here reads or writes StorageContract, so there's no conflict.
//
// No binary file upload/storage exists for this app yet (see
// documentService.js's own note on the same gap) — attachmentNote is a
// plain text pointer ("see Contracts drive, filename X") rather than a
// fabricated upload feature.
const contractSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  contractNumber: { type: String, required: true },
  title: { type: String, required: true },
  contractType: {
    type: String, required: true,
    enum: ['customer', 'supplier', 'lease', 'employment', 'nda', 'service_agreement', 'other'],
  },
  counterpartyName: { type: String, required: true }, // the other party — free text since they may not be an existing Customer/Supplier record
  relatedCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
  relatedSupplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
  value: { type: Number, default: null }, // contract value if monetary; null for e.g. an NDA
  currency: { type: String, default: 'PKR' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  autoRenew: { type: Boolean, default: false },
  renewalNoticeDays: { type: Number, default: 30 }, // how many days before endDate this flips to 'expiring_soon'
  status: {
    type: String, default: 'draft',
    enum: ['draft', 'active', 'expiring_soon', 'expired', 'terminated', 'renewed'],
  },
  terminationReason: { type: String, default: null },
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // who's responsible for this contract
  attachmentNote: { type: String, default: '' }, // e.g. "see Contracts drive, Acme-NDA-2026.pdf" — plain text, no upload infra exists yet
  renewedFromContractId: { type: Schema.Types.ObjectId, ref: 'Contract', default: null }, // set on the NEW contract created by renewContract()
}, { timestamps: true });

contractSchema.index({ companyId: 1, status: 1 });
contractSchema.index({ companyId: 1, endDate: 1 });

module.exports = model('Contract', contractSchema);
