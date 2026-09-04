/**
 * ThreeWayMatchService — compares a SupplierInvoice against the
 * PurchaseOrder it bills for and the GoodsReceivedNote(s) actually
 * received against that PO, so AP payment can be gated on "does what
 * we're being billed for match what we ordered and what actually showed
 * up" instead of running straight off the PO/GRN with no independent
 * check. Nothing here blocks the existing supplier-payment flow by
 * itself — matchStatus is informational until a caller chooses to check
 * it (see recordSupplierPayment's optional strictness note below) — this
 * is additive so existing payment recording keeps working exactly as
 * before for companies not yet using invoice matching.
 */
const SupplierInvoice = require('../models/SupplierInvoice');
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceivedNote = require('../models/GoodsReceivedNote');

function lineKey(productId, variantId) {
  return `${productId}:${variantId}`;
}

async function createSupplierInvoice(input) {
  const po = await PurchaseOrder.findOne({ _id: input.purchaseOrderId, companyId: input.companyId });
  if (!po) throw new Error('Purchase order not found.');

  const invoice = await SupplierInvoice.create({
    companyId: input.companyId,
    supplierId: input.supplierId || po.supplierId,
    purchaseOrderId: po._id,
    supplierInvoiceNumber: input.supplierInvoiceNumber,
    invoiceDate: input.invoiceDate || new Date(),
    items: input.items,
    totalAmount: input.totalAmount,
    tolerancePercent: input.tolerancePercent ?? 2,
  });

  return performMatch(invoice._id, invoice.companyId);
}

/**
 * Runs (or re-runs) the three-way match for an invoice: for each invoice
 * line, pulls the corresponding PO line (ordered qty/price) and sums
 * quantityReceived across every GRN raised against that PO for the same
 * product/variant, then flags a line 'variance' when the invoiced quantity
 * exceeds what was actually received, OR the invoiced price differs from
 * the PO price by more than the invoice's tolerance. The invoice-level
 * matchStatus is 'matched' only when every line is; otherwise 'variance'.
 */
async function performMatch(supplierInvoiceId, companyId) {
  const invoice = await SupplierInvoice.findOne({ _id: supplierInvoiceId, companyId });
  if (!invoice) throw new Error('Supplier invoice not found.');

  const po = await PurchaseOrder.findById(invoice.purchaseOrderId);
  if (!po) throw new Error('Linked purchase order not found.');

  const poLinesByKey = new Map(po.items.map((i) => [lineKey(i.productId, i.variantId), i]));

  const grns = await GoodsReceivedNote.find({ purchaseOrderId: po._id, companyId });
  const receivedByKey = new Map();
  for (const grn of grns) {
    for (const line of grn.items) {
      const key = lineKey(line.productId, line.variantId);
      receivedByKey.set(key, (receivedByKey.get(key) || 0) + line.quantity);
    }
  }

  let allMatched = true;
  for (const line of invoice.items) {
    const key = lineKey(line.productId, line.variantId);
    const poLine = poLinesByKey.get(key);
    const receivedQty = receivedByKey.get(key) || 0;

    line.quantityOrdered = poLine ? poLine.quantityOrdered : null;
    line.quantityReceived = receivedQty;
    line.priceOrdered = poLine ? poLine.unitCost : null;
    line.quantityVariance = line.quantityInvoiced - receivedQty;

    let priceOk = true;
    if (poLine) {
      line.priceVariance = line.unitPrice - poLine.unitCost;
      line.priceVariancePercent = poLine.unitCost > 0 ? (line.priceVariance / poLine.unitCost) * 100 : 0;
      priceOk = invoice.toleranceMode === 'amount'
        ? Math.abs(line.priceVariance) <= invoice.toleranceAmount
        : Math.abs(line.priceVariancePercent) <= invoice.tolerancePercent;
    } else {
      priceOk = false; // billed for something that isn't even on the PO
    }

    // Never billed for more than was actually received — a line can be
    // UNDER-invoiced relative to receipt (partial billing) without being a
    // problem; only over-billing relative to receipt is a real variance.
    const quantityOk = line.quantityInvoiced <= receivedQty;

    line.lineMatchStatus = poLine && priceOk && quantityOk ? 'matched' : 'variance';
    if (line.lineMatchStatus !== 'matched') allMatched = false;
  }

  invoice.matchStatus = allMatched ? 'matched' : 'variance';
  invoice.matchedAt = new Date();
  await invoice.save();
  return invoice;
}

async function approveSupplierInvoice(supplierInvoiceId, companyId, userId) {
  const invoice = await SupplierInvoice.findOne({ _id: supplierInvoiceId, companyId });
  if (!invoice) throw new Error('Supplier invoice not found.');
  if (!['matched', 'variance'].includes(invoice.matchStatus)) {
    throw new Error('Run the three-way match before approving this invoice.');
  }
  invoice.matchStatus = 'approved';
  invoice.approvedBy = userId;
  invoice.approvedAt = new Date();
  return invoice.save();
}

async function rejectSupplierInvoice(supplierInvoiceId, companyId, userId, reason) {
  const invoice = await SupplierInvoice.findOne({ _id: supplierInvoiceId, companyId });
  if (!invoice) throw new Error('Supplier invoice not found.');
  invoice.matchStatus = 'rejected';
  invoice.rejectionReason = reason || '';
  return invoice.save();
}

function listSupplierInvoices(companyId, { purchaseOrderId, supplierId, matchStatus } = {}) {
  const filter = { companyId };
  if (purchaseOrderId) filter.purchaseOrderId = purchaseOrderId;
  if (supplierId) filter.supplierId = supplierId;
  if (matchStatus) filter.matchStatus = matchStatus;
  return SupplierInvoice.find(filter).sort({ createdAt: -1 });
}

function getSupplierInvoice(supplierInvoiceId, companyId) {
  return SupplierInvoice.findOne({ _id: supplierInvoiceId, companyId })
    .populate('supplierId', 'name')
    .populate('purchaseOrderId', 'poNumber');
}

/**
 * Whether it's SAFE to pay this invoice per the three-way match — a helper
 * for whatever records the actual supplier payment to consult, rather than
 * this service reaching into accounting/payment code itself. 'approved' is
 * required, not merely 'matched', so a human always signs off even on a
 * clean match.
 */
async function isPayable(supplierInvoiceId, companyId) {
  const invoice = await SupplierInvoice.findOne({ _id: supplierInvoiceId, companyId });
  return !!invoice && invoice.matchStatus === 'approved';
}

module.exports = {
  createSupplierInvoice,
  performMatch,
  approveSupplierInvoice,
  rejectSupplierInvoice,
  listSupplierInvoices,
  getSupplierInvoice,
  isPayable,
};
