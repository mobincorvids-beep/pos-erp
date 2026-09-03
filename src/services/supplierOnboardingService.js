/**
 * SupplierOnboardingService — vendor onboarding/qualification workflow on
 * top of Supplier.onboarding (see that model for the field shapes). The
 * approval step deliberately reuses ApprovalService/ApprovalRequest — the
 * exact same generic engine PurchaseOrder and PurchaseRequisition already
 * go through — rather than a bespoke onboarding-specific approval
 * mechanism. entityType 'SupplierOnboarding' has no WorkflowDefinition by
 * default, so it falls back to ApprovalService's single-implicit-step
 * behavior unless a company explicitly configures a multi-step one via
 * approvalService.defineWorkflow({ entityType: 'SupplierOnboarding', ... }).
 */
const Supplier = require('../models/Supplier');
const approvalService = require('./approvalService');
const auditService = require('./auditService');

/** Sets/replaces the required-document checklist for a supplier still in onboarding. */
async function setChecklist(companyId, supplierId, labels) {
  const supplier = await Supplier.findOne({ _id: supplierId, companyId });
  if (!supplier) throw new Error('Supplier not found.');
  if (!Array.isArray(labels) || labels.length === 0) throw new Error('At least one required document label is needed.');

  supplier.onboarding.requiredDocuments = labels.map((label) => ({ label, documentId: null, submittedAt: null }));
  await supplier.save();
  return supplier;
}

/** Marks one checklist entry as submitted, linking the uploaded Document. */
async function submitDocument(companyId, supplierId, label, documentId) {
  const supplier = await Supplier.findOne({ _id: supplierId, companyId });
  if (!supplier) throw new Error('Supplier not found.');

  const entry = supplier.onboarding.requiredDocuments.find((d) => d.label === label);
  if (!entry) throw new Error(`"${label}" is not on this supplier's required-document checklist.`);
  entry.documentId = documentId;
  entry.submittedAt = new Date();

  const allSubmitted = supplier.onboarding.requiredDocuments.every((d) => d.documentId);
  if (allSubmitted && supplier.onboarding.status === 'draft') {
    supplier.onboarding.status = 'documents_submitted';
  }
  await supplier.save();
  return supplier;
}

/**
 * Moves the supplier into review and opens an ApprovalRequest. Requires
 * every checklist document to already be submitted, so a review never
 * starts on an incomplete file.
 */
async function submitForReview(companyId, supplierId, { userId, note } = {}) {
  const supplier = await Supplier.findOne({ _id: supplierId, companyId });
  if (!supplier) throw new Error('Supplier not found.');
  if (supplier.onboarding.status === 'under_review') throw new Error('Already under review.');
  if (supplier.onboarding.status === 'approved') throw new Error('Already approved.');

  const outstanding = supplier.onboarding.requiredDocuments.filter((d) => !d.documentId);
  if (outstanding.length > 0) {
    throw new Error(`Cannot submit for review: missing document(s) — ${outstanding.map((d) => d.label).join(', ')}.`);
  }

  const approval = await approvalService.request({
    companyId, entityType: 'SupplierOnboarding', entityId: supplier._id, requestedBy: userId, note,
  });

  supplier.onboarding.status = 'under_review';
  supplier.onboarding.approvalRequestId = approval._id;
  supplier.onboarding.submittedAt = new Date();
  await supplier.save();

  await auditService.record({
    companyId, userId, action: 'supplier.onboarding.submitted', entityType: 'Supplier', entityId: supplier._id,
  });

  return supplier;
}

/** Decides the open onboarding approval — approve qualifies the supplier, reject sends it back to draft for correction. */
async function decideOnboarding(companyId, supplierId, { approve, userId, note }) {
  const supplier = await Supplier.findOne({ _id: supplierId, companyId });
  if (!supplier) throw new Error('Supplier not found.');
  if (supplier.onboarding.status !== 'under_review') throw new Error(`Cannot decide: onboarding status is "${supplier.onboarding.status}", not "under_review".`);
  if (!supplier.onboarding.approvalRequestId) throw new Error('No approval request found for this supplier\'s onboarding.');

  await approvalService.decide(supplier.onboarding.approvalRequestId, { approve, userId, note });

  supplier.onboarding.status = approve ? 'approved' : 'rejected';
  supplier.onboarding.decidedAt = new Date();
  if (note) supplier.onboarding.note = note;
  await supplier.save();

  await auditService.record({
    companyId, userId, action: approve ? 'supplier.onboarding.approved' : 'supplier.onboarding.rejected',
    entityType: 'Supplier', entityId: supplier._id,
  });

  return supplier;
}

function getOnboarding(companyId, supplierId) {
  return Supplier.findOne({ _id: supplierId, companyId }).select('name onboarding');
}

function listByStatus(companyId, status) {
  const filter = { companyId };
  if (status) filter['onboarding.status'] = status;
  return Supplier.find(filter).select('name onboarding').sort({ 'onboarding.submittedAt': -1 });
}

module.exports = { setChecklist, submitDocument, submitForReview, decideOnboarding, getOnboarding, listByStatus };
