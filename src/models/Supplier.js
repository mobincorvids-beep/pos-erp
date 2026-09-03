const { Schema, model } = require('mongoose');

const supplierSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  phone: String,
  email: String,
  address: String,
  openingBalance: { type: Number, default: 0 }, // +ve = company owes supplier

  // Typical time between placing a PO with this supplier and the goods
  // actually arriving. Additive/optional — 0 means "not tracked", so every
  // existing supplier and every prior read of this document is unaffected.
  // reorderRuleService.listBelowReorderPoint() reads this to flag stock
  // that's projected to run out before a fresh PO could realistically land.
  leadTimeDays: { type: Number, default: 0, min: 0 },

  // --- Vendor onboarding / qualification workflow ---
  // Kept as plain fields on Supplier rather than a separate collection: a
  // supplier's onboarding state is 1:1 with the supplier and small (a
  // status + a document checklist). The approval step itself is NOT
  // reinvented here — see supplierOnboardingService.submitForReview(),
  // which calls approvalService.request({ entityType: 'SupplierOnboarding',
  // ... }), the exact same generic ApprovalRequest engine PurchaseOrder and
  // PurchaseRequisition already use. Defaults to 'draft' with an empty
  // checklist, so every existing Supplier (created before this feature)
  // reads back unaffected and is simply treated as not-yet-onboarded.
  onboarding: {
    status: {
      type: String,
      default: 'draft',
      enum: ['draft', 'documents_submitted', 'under_review', 'approved', 'rejected'],
    },
    // Free-form checklist of required documents for this supplier to be
    // qualified (e.g. "Tax registration certificate", "Bank account
    // proof"). Each entry links to a Document record (the same
    // Document-linking pattern already used elsewhere in this app) once
    // actually uploaded; documentId stays null until then, so the
    // checklist can be defined up front and filled in as evidence arrives.
    requiredDocuments: [{
      label: { type: String, required: true },
      documentId: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
      submittedAt: { type: Date, default: null },
      _id: false,
    }],
    approvalRequestId: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest', default: null },
    submittedAt: { type: Date, default: null },
    decidedAt: { type: Date, default: null },
    note: String,
  },
}, { timestamps: true });

module.exports = model('Supplier', supplierSchema);
