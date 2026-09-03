/**
 * RmaService — the Return Merchandise Authorization request/approval
 * workflow: requested -> approved -> received -> refunded (or rejected
 * any time before received). Distinct from saleReturnService (an
 * immediate, already-decided POS-counter return) — an RMA models staff
 * reviewing and approving a customer's request first, goods traveling
 * back later, and refunding only once they're actually received.
 *
 * On status -> 'received': posts a real stock-in movement via
 * inventoryService.recordMovement, same as saleReturnService does for a
 * direct return.
 * On status -> 'refunded': issues a CreditNote via the existing
 * creditNoteService.issueCreditNote, reusing that module's ledger posting
 * rather than duplicating it here.
 */
const mongoose = require('mongoose');
const RMA = require('../models/RMA');
const Sale = require('../models/Sale');
const inventoryService = require('./inventoryService');
const creditNoteService = require('./creditNoteService');
const { nextDocumentNumber } = require('./numberingService');

async function createRMA(companyId, { saleId, items, requestedBy }) {
  if (!items || items.length === 0) throw new Error('An RMA must contain at least one item.');
  const sale = await Sale.findOne({ _id: saleId, companyId });
  if (!sale) throw new Error('Sale not found.');
  if (sale.status !== 'completed' && sale.status !== 'returned') {
    throw new Error(`Cannot open an RMA against a sale with status "${sale.status}".`);
  }

  // Every requested line must actually have been sold on this invoice —
  // same guard saleReturnService applies to a direct return.
  for (const item of items) {
    const original = sale.items.find((i) =>
      String(i.variantId) === String(item.variantId) && String(i.productId) === String(item.productId)
    );
    if (!original) throw new Error(`Item ${item.variantId} was not part of this sale.`);
    if (item.quantity <= 0 || item.quantity > original.quantity) {
      throw new Error(`Cannot request ${item.quantity} of a line only ${original.quantity} were sold on.`);
    }
  }

  return RMA.create({
    companyId, saleId, customerId: sale.customerId || null,
    rmaNumber: nextDocumentNumber('RMA'),
    items, requestedBy, status: 'requested',
  });
}

function listRMAs(companyId, { status, saleId, customerId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (saleId) filter.saleId = saleId;
  if (customerId) filter.customerId = customerId;
  return RMA.find(filter).sort({ createdAt: -1 });
}

async function getRMA(companyId, id) {
  const rma = await RMA.findOne({ _id: id, companyId });
  if (!rma) throw new Error('RMA not found.');
  return rma;
}

const TRANSITIONS = {
  requested: ['approved', 'rejected'],
  approved: ['received', 'rejected'],
  received: ['refunded'],
  refunded: [],
  rejected: [],
};

/**
 * Advances an RMA's status. `input` shape depends on the target status:
 *  - approved: { userId }
 *  - rejected: { userId, reason }
 *  - received: { userId, warehouseId } — posts the stock-in movement
 *  - refunded: { userId, refundAmount?, arAccountId?, revenueAccountId? } —
 *    issues a credit note for refundAmount (defaults to the RMA lines'
 *    value at the original sale price)
 */
async function updateStatus(companyId, id, targetStatus, input = {}) {
  const rma = await RMA.findOne({ _id: id, companyId });
  if (!rma) throw new Error('RMA not found.');

  const allowed = TRANSITIONS[rma.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(`Cannot move an RMA from "${rma.status}" to "${targetStatus}".`);
  }

  if (targetStatus === 'approved') {
    rma.status = 'approved';
    rma.approvedBy = input.userId || null;
    rma.approvedAt = new Date();
    return rma.save();
  }

  if (targetStatus === 'rejected') {
    rma.status = 'rejected';
    rma.rejectedReason = input.reason || null;
    return rma.save();
  }

  if (targetStatus === 'received') {
    if (!input.warehouseId) throw new Error('warehouseId is required to receive an RMA (which warehouse the stock is coming back into).');
    const sale = await Sale.findOne({ _id: rma.saleId, companyId });
    if (!sale) throw new Error('Original sale not found.');

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of rma.items) {
          await inventoryService.recordMovement({
            companyId, warehouseId: input.warehouseId,
            productId: item.productId, variantId: item.variantId, batchId: null,
            type: 'rma_return', quantity: item.quantity,
            referenceType: 'RMA', referenceId: rma._id, userId: input.userId,
            note: `RMA ${rma.rmaNumber} received against sale ${sale.invoiceNumber || sale.documentNumber}`,
          }, session);
        }
        rma.status = 'received';
        rma.receivedAt = new Date();
        rma.warehouseId = input.warehouseId;
        await rma.save({ session });
      });
    } finally {
      session.endSession();
    }
    return rma;
  }

  if (targetStatus === 'refunded') {
    const sale = await Sale.findOne({ _id: rma.saleId, companyId });
    if (!sale) throw new Error('Original sale not found.');
    if (!rma.customerId) throw new Error('This RMA has no customer to refund (the original sale had no customer on file).');

    // Default refund amount: each RMA line's quantity priced at what it
    // actually sold for on the original invoice, mirroring how
    // saleReturnService values a return.
    let refundAmount = input.refundAmount;
    if (!refundAmount) {
      refundAmount = rma.items.reduce((sum, item) => {
        const original = sale.items.find((i) => String(i.variantId) === String(item.variantId));
        return sum + (original ? original.unitPrice * item.quantity : 0);
      }, 0);
    }

    const creditNote = await creditNoteService.issueCreditNote({
      companyId, branchId: sale.branchId, customerId: rma.customerId,
      amount: refundAmount, saleId: sale._id,
      reason: `RMA ${rma.rmaNumber} refund`,
      arAccountId: input.arAccountId, revenueAccountId: input.revenueAccountId,
      userId: input.userId,
    });

    rma.status = 'refunded';
    rma.refundAmount = refundAmount;
    rma.creditNoteId = creditNote._id;
    await rma.save();
    return rma;
  }

  throw new Error(`Unhandled RMA target status "${targetStatus}".`);
}

module.exports = { createRMA, listRMAs, getRMA, updateStatus };
