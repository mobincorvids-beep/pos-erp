/**
 * RequisitionService — "someone needs to buy X" before any supplier or
 * price is picked. approve() just flips status; convertToPurchaseOrder
 * (called by the caller with a chosen supplier/quote) hands off to
 * purchaseService.createPurchaseOrder with requisitionId set, so the
 * PO->GRN chain stays traceable back to the original request.
 */
const PurchaseRequisition = require('../models/PurchaseRequisition');
const SupplierQuote = require('../models/SupplierQuote');
const { nextDocumentNumber } = require('./numberingService');

function create(input) {
  const { companyId, branchId, items, requestedBy, note } = input;
  if (!items || items.length === 0) throw new Error('Requisition must contain at least one item.');
  return PurchaseRequisition.create({
    companyId, branchId, items, requestedBy, note,
    requisitionNumber: nextDocumentNumber('REQ'),
  });
}

async function decide(requisitionId, { approve, userId }) {
  const requisition = await PurchaseRequisition.findById(requisitionId);
  if (!requisition) throw new Error('Requisition not found.');
  if (requisition.status !== 'pending') throw new Error(`Already ${requisition.status}.`);

  requisition.status = approve ? 'approved' : 'rejected';
  requisition.approvedBy = userId;
  requisition.approvedAt = new Date();
  await requisition.save();
  return requisition;
}

function submitQuote(input) {
  const { companyId, requisitionId, supplierId, items, validUntil } = input;
  return SupplierQuote.create({ companyId, requisitionId, supplierId, items, validUntil });
}

/** Quotes for a requisition, ranked cheapest-total-first — the "cost comparison" the proposal called out under Purchase & Supplier Management. */
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
