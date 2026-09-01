/**
 * SaleReturnService — returns/refunds and void, the two POS workflows the
 * checkout-only PosSaleService never covered. Both reverse stock through
 * InventoryService and reverse accounting through AccountingService, same
 * as every other module — a return is not a special case, it's just
 * movement/voucher signs flipped relative to the original sale.
 */
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const Account = require('../models/Account');
const inventoryService = require('./inventoryService');
const accountingService = require('./accountingService');
const auditService = require('./auditService');
const serialInventoryService = require('./serialInventoryService');
const defaultAccountsService = require('./defaultAccountsService');
const { nextDocumentNumber } = require('./numberingService');

/**
 * @param {String} saleId
 * @param {Object} input
 * @param {Array} input.items - [{ productId, variantId, batchId?, serialNumbers?, quantity }] — quantity being returned, not the original sold quantity. For serial-tracked lines, serialNumbers must be a subset of what was actually sold on that line and its length must equal quantity.
 * @param {String} input.refundAccountId
 * @param {String} [input.reason]
 * @param {String} [input.userId]
 */
async function processReturn(saleId, input) {
  const session = await mongoose.startSession();
  try {
    let saleReturn;

    await session.withTransaction(async () => {
      const sale = await Sale.findById(saleId).session(session);
      if (!sale) throw new Error('Sale not found.');
      if (sale.status !== 'completed') throw new Error(`Cannot return items from a sale with status "${sale.status}".`);

      const { items, refundAccountId, reason, userId } = input;
      if (!items || items.length === 0) throw new Error('Return must contain at least one item.');

      // Validate each returned line against what was actually sold, accounting
      // for quantity already returned in previous partial returns.
      const priorReturns = await SaleReturn.find({ saleId }).session(session);
      const alreadyReturned = new Map(); // variantId(+batchId) -> qty
      const alreadyReturnedSerials = new Set();
      for (const r of priorReturns) {
        for (const i of r.items) {
          const key = `${i.variantId}:${i.batchId || ''}`;
          alreadyReturned.set(key, (alreadyReturned.get(key) || 0) + i.quantity);
          (i.serialNumbers || []).forEach((s) => alreadyReturnedSerials.add(s));
        }
      }

      let totalAmount = 0;
      const returnItems = items.map((reqItem) => {
        const key = `${reqItem.variantId}:${reqItem.batchId || ''}`;
        const original = sale.items.find(
          (i) => String(i.variantId) === String(reqItem.variantId) && String(i.batchId || '') === String(reqItem.batchId || '')
        );
        if (!original) throw new Error(`Item ${reqItem.variantId} was not part of this sale.`);

        const soldQty = original.quantity;
        const alreadyQty = alreadyReturned.get(key) || 0;
        if (alreadyQty + reqItem.quantity > soldQty) {
          throw new Error(`Cannot return ${reqItem.quantity}: only ${soldQty - alreadyQty} of this item remain returnable.`);
        }

        // Serial-tracked line: the returned serials must actually have been
        // sold on this line, not already returned once, and the count must
        // match the quantity being returned — same "one serial per unit" rule as checkout.
        if (original.serialNumbers && original.serialNumbers.length > 0) {
          const requestedSerials = reqItem.serialNumbers || [];
          if (requestedSerials.length !== reqItem.quantity) {
            throw new Error(`This line is serial-tracked, provide exactly ${reqItem.quantity} serial number(s) being returned.`);
          }
          for (const serial of requestedSerials) {
            if (!original.serialNumbers.includes(serial)) throw new Error(`Serial ${serial} was not part of this sale's line for this product.`);
            if (alreadyReturnedSerials.has(serial)) throw new Error(`Serial ${serial} has already been returned once.`);
          }
        }

        const lineTotal = original.unitPrice * reqItem.quantity;
        totalAmount += lineTotal;

        return {
          productId: original.productId, variantId: original.variantId, batchId: original.batchId,
          serialNumbers: reqItem.serialNumbers || [],
          quantity: reqItem.quantity, unitPrice: original.unitPrice, lineTotal,
        };
      });

      [saleReturn] = await SaleReturn.create(
        [{
          companyId: sale.companyId, saleId: sale._id, returnNumber: nextDocumentNumber('RTN'),
          items: returnItems, totalAmount, refundAccountId, reason, userId,
        }],
        { session }
      );

      // 1. Stock comes back in, and any specific serials return to sellable status.
      for (const item of returnItems) {
        await inventoryService.recordMovement({
          companyId: sale.companyId, warehouseId: sale.warehouseId,
          productId: item.productId, variantId: item.variantId, batchId: item.batchId,
          type: 'sale_return', quantity: item.quantity,
          referenceType: 'SaleReturn', referenceId: saleReturn._id, userId,
          note: `Return ${saleReturn.returnNumber} against sale ${sale.invoiceNumber}`,
        }, session);

        if (item.serialNumbers.length > 0) {
          await serialInventoryService.releaseToStock(item.variantId, item.serialNumbers, session);
        }
      }

      // 2. Reverse the revenue, refund the money: Dr Sales Revenue, Cr Cash/Bank.
      const revenueAccount = await defaultAccountsService.resolve(sale.companyId, 'salesRevenueId', session);
      if (revenueAccount) {
        await accountingService.postVoucher({
          companyId: sale.companyId, branchId: sale.branchId, type: 'payment',
          narration: `Return ${saleReturn.returnNumber} against sale ${sale.invoiceNumber}`,
          entries: [
            { accountId: revenueAccount, debit: totalAmount, credit: 0 },
            { accountId: refundAccountId, debit: 0, credit: totalAmount },
          ],
          referenceType: 'SaleReturn', referenceId: saleReturn._id, userId,
        }, session);
      }

      // If everything ever sold on this sale has now been returned, mark it.
      const allReturned = sale.items.every((orig) => {
        const key = `${orig.variantId}:${orig.batchId || ''}`;
        const total = (alreadyReturned.get(key) || 0) + returnItems
          .filter((r) => String(r.variantId) === String(orig.variantId) && String(r.batchId || '') === String(orig.batchId || ''))
          .reduce((sum, r) => sum + r.quantity, 0);
        return total >= orig.quantity;
      });
      if (allReturned) {
        sale.status = 'returned';
        await sale.save({ session });
      }

      await auditService.record({
        companyId: sale.companyId, userId, action: 'sale.returned', entityType: 'Sale', entityId: sale._id,
        metadata: { returnNumber: saleReturn.returnNumber, totalAmount },
      }, session);
    });

    return saleReturn;
  } finally {
    session.endSession();
  }
}

/**
 * Voids a completed sale outright (not a partial return) — reverses all
 * stock and posts a fully reversing voucher, then marks the sale cancelled.
 * Only allowed if nothing has been returned against it yet.
 */
async function voidSale(saleId, { userId, reason }) {
  const session = await mongoose.startSession();
  try {
    let sale;

    await session.withTransaction(async () => {
      sale = await Sale.findById(saleId).session(session);
      if (!sale) throw new Error('Sale not found.');
      if (sale.status !== 'completed') throw new Error(`Cannot void a sale with status "${sale.status}".`);

      const hasReturns = await SaleReturn.exists({ saleId }).session(session);
      if (hasReturns) throw new Error('Cannot void a sale that already has returns against it, process a full return instead.');

      for (const item of sale.items) {
        await inventoryService.recordMovement({
          companyId: sale.companyId, warehouseId: sale.warehouseId,
          productId: item.productId, variantId: item.variantId, batchId: item.batchId,
          type: 'void', quantity: item.quantity, // reverse the original -qty sale movement
          referenceType: 'Sale', referenceId: sale._id, userId,
          note: `Void: ${reason || 'no reason given'}`,
        }, session);

        if (item.serialNumbers && item.serialNumbers.length > 0) {
          await serialInventoryService.releaseToStock(item.variantId, item.serialNumbers, session);
        }
      }

      const revenueAccount = await defaultAccountsService.resolve(sale.companyId, 'salesRevenueId', session);
      const entries = [];
      if (revenueAccount) entries.push({ accountId: revenueAccount, debit: sale.subtotal - sale.discountAmount, credit: 0 });
      for (const payment of sale.payments) {
        entries.push({ accountId: payment.paymentAccountId, debit: 0, credit: payment.amount });
      }
      if (entries.length > 0) {
        await accountingService.postVoucher({
          companyId: sale.companyId, branchId: sale.branchId, type: 'journal',
          narration: `Voided sale ${sale.invoiceNumber}: ${reason || ''}`,
          entries, referenceType: 'Sale', referenceId: sale._id, userId,
        }, session);
      }

      sale.status = 'cancelled';
      await sale.save({ session });

      await auditService.record({
        companyId: sale.companyId, userId, action: 'sale.voided', entityType: 'Sale', entityId: sale._id,
        metadata: { invoiceNumber: sale.invoiceNumber, reason },
      }, session);
    });

    return sale;
  } finally {
    session.endSession();
  }
}

module.exports = { processReturn, voidSale };
