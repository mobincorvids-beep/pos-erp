/**
 * RFQService — the genuinely new mechanic: an RFQ is sent to several
 * suppliers, and compareQuotations() finds the CHEAPEST price per LINE
 * ITEM across every quotation received — not one overall "winning"
 * supplier. convertBestPriceToOrders() then does the real, valuable
 * thing that follows from that: since a single PurchaseOrder can only
 * have one supplier, the RFQ's items are grouped by whichever supplier
 * actually won each one, and ONE real PurchaseOrder is created PER
 * supplier group — genuine multi-supplier sourcing off a single RFQ,
 * reusing core purchaseService.createPurchaseOrder rather than
 * duplicating PO-creation logic.
 */
const RFQ = require('../models/RFQ');
const SupplierQuotation = require('../models/SupplierQuotation');
const purchaseService = require('./purchaseService');

function createRFQ(input) {
  const { companyId, branchId, items, invitedSupplierIds, dueDate } = input;
  if (!items || items.length === 0) throw new Error('At least one item is required.');
  return RFQ.create({ companyId, branchId, items, invitedSupplierIds: invitedSupplierIds || [], dueDate });
}

function listRFQs(companyId, { status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return RFQ.find(filter).sort({ createdAt: -1 });
}

/** A supplier's real response — validated to only quote items that are actually on this RFQ, so the comparison stays a genuine apples-to-apples one. */
async function submitQuotation(rfqId, { supplierId, items }) {
  const rfq = await RFQ.findById(rfqId);
  if (!rfq) throw new Error('RFQ not found.');
  if (rfq.status !== 'open') throw new Error(`Cannot submit a quotation against an RFQ with status "${rfq.status}".`);

  let totalAmount = 0;
  for (const item of items) {
    const rfqLine = rfq.items.find((l) => String(l.productId) === String(item.productId) && String(l.variantId) === String(item.variantId));
    if (!rfqLine) throw new Error(`Quoted item (product ${item.productId}) is not part of this RFQ's requested items.`);
    if (!item.unitPrice || item.unitPrice <= 0) throw new Error('unitPrice must be greater than zero for every quoted item.');
    totalAmount += item.unitPrice * rfqLine.quantity;
  }
  totalAmount = Math.round(totalAmount * 100) / 100;

  return SupplierQuotation.create({ companyId: rfq.companyId, rfqId, supplierId, items, totalAmount });
}

function listQuotations(rfqId) {
  return SupplierQuotation.find({ rfqId }).populate('supplierId', 'name').sort({ totalAmount: 1 });
}

/** The real comparison — cheapest price PER ITEM, across every quotation received for this RFQ, not one overall winner. */
async function compareQuotations(rfqId) {
  const quotations = await SupplierQuotation.find({ rfqId }).populate('supplierId', 'name');
  const bestByItem = {};
  for (const quotation of quotations) {
    for (const item of quotation.items) {
      const key = `${item.productId}:${item.variantId}`;
      if (!bestByItem[key] || item.unitPrice < bestByItem[key].unitPrice) {
        bestByItem[key] = { productId: item.productId, variantId: item.variantId, supplierId: quotation.supplierId, unitPrice: item.unitPrice, quotationId: quotation._id };
      }
    }
  }
  return { rfqId, quotationCount: quotations.length, bestByItem: Object.values(bestByItem) };
}

/**
 * Groups the RFQ's items by whichever supplier actually won each one, and
 * creates ONE real PurchaseOrder per supplier group — genuine
 * multi-supplier sourcing off a single RFQ, since a PO can only carry one
 * supplier. Reuses core purchaseService.createPurchaseOrder directly, not
 * a second, parallel PO-creation path.
 */
async function convertBestPriceToOrders(rfqId, { branchId, warehouseId, userId }) {
  const rfq = await RFQ.findById(rfqId);
  if (!rfq) throw new Error('RFQ not found.');
  const { bestByItem } = await compareQuotations(rfqId);
  if (bestByItem.length === 0) throw new Error('No quotations have been submitted for this RFQ yet.');

  const groupedBySupplier = {};
  for (const winner of bestByItem) {
    const rfqLine = rfq.items.find((l) => String(l.productId) === String(winner.productId) && String(l.variantId) === String(winner.variantId));
    const supplierKey = String(winner.supplierId._id || winner.supplierId);
    if (!groupedBySupplier[supplierKey]) groupedBySupplier[supplierKey] = [];
    groupedBySupplier[supplierKey].push({ productId: winner.productId, variantId: winner.variantId, quantityOrdered: rfqLine.quantity, unitCost: winner.unitPrice });
  }

  const orders = [];
  for (const [supplierId, items] of Object.entries(groupedBySupplier)) {
    const po = await purchaseService.createPurchaseOrder({ companyId: rfq.companyId, branchId, warehouseId, supplierId, items, userId });
    orders.push(po);
  }

  rfq.status = 'closed';
  await rfq.save();

  return orders;
}

module.exports = { createRFQ, listRFQs, submitQuotation, listQuotations, compareQuotations, convertBestPriceToOrders };
