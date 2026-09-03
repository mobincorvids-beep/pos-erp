/**
 * RequisitionService — "someone needs to buy X" before any supplier or
 * price is picked. create() now opens a real ApprovalRequest via
 * approvalService — the same multi-step workflow engine PurchaseOrder uses
 * (see purchaseService.createPurchaseOrder / decidePurchaseOrder) — instead
 * of the requisition just sitting there as a flat pending/approved/rejected
 * field with no configurable steps. A requisition has no price yet (that's
 * what SupplierQuote adds), so it's requested with no `amount`, which the
 * workflow engine treats as "every configured step applies" — exactly the
 * same fallback behavior as an entityType with no WorkflowDefinition at
 * all, so this is backward compatible with any company that hasn't
 * configured a PurchaseRequisition workflow.
 * convertToPurchaseOrder (called by the caller with a chosen supplier/quote)
 * hands off to purchaseService.createPurchaseOrder with requisitionId set,
 * so the PO->GRN chain stays traceable back to the original request.
 */
const PurchaseRequisition = require('../models/PurchaseRequisition');
const SupplierQuote = require('../models/SupplierQuote');
const approvalService = require('./approvalService');
const auditService = require('./auditService');
const { nextDocumentNumber } = require('./numberingService');

async function create(input) {
  const { companyId, branchId, items, requestedBy, note } = input;
  if (!items || items.length === 0) throw new Error('Requisition must contain at least one item.');
  const requisition = await PurchaseRequisition.create({
    companyId, branchId, items, requestedBy, note,
    requisitionNumber: nextDocumentNumber('REQ'),
  });

  await approvalService.request({
    companyId, entityType: 'PurchaseRequisition', entityId: requisition._id, requestedBy, note,
  });

  return requisition;
}

/**
 * Decides the requisition's CURRENT approval step through the real workflow
 * engine (same as purchaseService.decidePurchaseOrder for PurchaseOrder).
 * Only once the whole ApprovalRequest chain resolves (approved or rejected
 * — a rejection at any step kills the chain) does the requisition's own
 * status flip; a multi-step chain still mid-flight keeps the requisition
 * 'pending' after an intermediate step is approved. approvedBy/approvedAt
 * are still mirrored onto the requisition for backward compatibility with
 * any old code reading those fields directly (see the model comment) —
 * they are no longer the source of truth for the decision itself.
 */
async function decide(requisitionId, { approve, userId, note }) {
  const requisition = await PurchaseRequisition.findById(requisitionId);
  if (!requisition) throw new Error('Requisition not found.');
  if (requisition.status !== 'pending') throw new Error(`Already ${requisition.status}.`);

  const approval = await approvalService.findFor('PurchaseRequisition', requisitionId);
  if (!approval) throw new Error('No approval request found for this requisition.');
  await approvalService.decide(approval._id, { approve, userId, note });

  const refreshed = await approvalService.findFor('PurchaseRequisition', requisitionId);
  if (refreshed.status !== 'pending') {
    requisition.status = refreshed.status;
    requisition.approvedBy = refreshed.approvedBy;
    requisition.approvedAt = refreshed.approvedAt;
    await requisition.save();

    await auditService.record({
      companyId: requisition.companyId, userId,
      action: refreshed.status === 'approved' ? 'purchase_requisition.approved' : 'purchase_requisition.rejected',
      entityType: 'PurchaseRequisition', entityId: requisition._id,
    });
  }

  return requisition;
}

function submitQuote(input) {
  const { companyId, requisitionId, supplierId, items, validUntil } = input;
  return SupplierQuote.create({ companyId, requisitionId, supplierId, items, validUntil });
}

/** Quotes for a requisition, ranked cheapest-total-first, the "cost comparison" the proposal called out under Purchase & Supplier Management. */
async function compareQuotes(requisitionId) {
  const quotes = await SupplierQuote.find({ requisitionId }).populate('supplierId', 'name');
  return quotes
    .map((q) => ({
      quoteId: q._id,
      supplierId: q.supplierId?._id,
      supplierName: q.supplierId?.name,
      total: q.items.reduce((sum, i) => sum + i.quotedUnitCost, 0),
      items: q.items,
      validUntil: q.validUntil,
    }))
    .sort((a, b) => a.total - b.total);
}

async function markRequisitionConverted(requisitionId) {
  await PurchaseRequisition.findByIdAndUpdate(requisitionId, { status: 'converted' });
}

module.exports = { create, decide, submitQuote, compareQuotes, markRequisitionConverted };
