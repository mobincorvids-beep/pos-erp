/**
 * SalesOrderService — quotations and sales orders. These are commitments,
 * not transactions: creating or advancing one never touches stock or the
 * ledger. Only convertToInvoice() does — at that point it runs the exact
 * same stock-deduction + voucher-posting logic as PosSaleService.checkout(),
 * just against an existing Sale document instead of creating a new one.
 *
 * Flow: createQuotation -> convertQuotationToSalesOrder -> convertToInvoice
 * (matches the CRM -> Quotation -> Sales Order -> POS/Invoice flow from the
 * proposal's "Complete ERP Flow" section). A sales order can also be created
 * directly, skipping the quotation step.
 */
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Account = require('../models/Account');
const inventoryService = require('./inventoryService');
const accountingService = require('./accountingService');
const bundleService = require('./bundleService');
const serialInventoryService = require('./serialInventoryService');
const defaultAccountsService = require('./defaultAccountsService');
const { nextInvoiceNumber, nextDocumentNumber } = require('./numberingService');
const { computeLineItems } = require('./saleCalculations');

async function createDraft(input, { saleType, prefix, status, reserveStock }) {
  const { companyId, branchId, warehouseId, customerId, userId, items, validUntil } = input;
  if (!items || items.length === 0) throw new Error(`${saleType} must contain at least one item.`);
  if (!warehouseId) throw new Error('warehouseId is required (the warehouse this document expects to fulfill from).');

  const { lineItems, subtotal, discountTotal, taxTotal, totalAmount } = computeLineItems(items);

  if (!reserveStock) {
    // Quotations don't touch stock at all — no transaction needed.
    return Sale.create({
      companyId, branchId, warehouseId, customerId, userId,
      documentNumber: nextDocumentNumber(prefix),
      status, saleType,
      items: lineItems,
      subtotal, discountAmount: discountTotal, taxAmount: taxTotal,
      totalAmount, paidAmount: 0, dueAmount: totalAmount,
      validUntil: validUntil || null,
    });
  }

  // Sales orders commit stock (reserve, don't deduct) so it can't be
  // double-sold to someone else while this order is pending invoicing.
  // Check + create + reserve all happen in one transaction so a failure
  // partway through can't leave a sales order without its reservation.
  const session = await mongoose.startSession();
  try {
    let sale;
    await session.withTransaction(async () => {
      const expandedItems = await bundleService.expandItems(lineItems, session);
      for (const item of expandedItems) {
        await inventoryService.assertSufficientStock(warehouseId, item.variantId, item.batchId, item.quantity);
      }

      [sale] = await Sale.create(
        [{
          companyId, branchId, warehouseId, customerId, userId,
          documentNumber: nextDocumentNumber(prefix),
          status, saleType,
          items: lineItems,
          subtotal, discountAmount: discountTotal, taxAmount: taxTotal,
          totalAmount, paidAmount: 0, dueAmount: totalAmount,
          validUntil: validUntil || null,
        }],
        { session }
      );

      for (const item of expandedItems) {
        await inventoryService.reserve(warehouseId, item.variantId, item.batchId, item.quantity, session);
      }
    });
    return sale;
  } finally {
    session.endSession();
  }
}

function createQuotation(input) {
  return createDraft(input, { saleType: 'quotation', prefix: 'QUO', status: 'quotation', reserveStock: false });
}

function createSalesOrder(input) {
  return createDraft(input, { saleType: 'sales_order', prefix: 'SO', status: 'sales_order', reserveStock: true });
}

/** Quotation accepted by the customer -> becomes a sales order. No stock/ledger effect. */
async function convertQuotationToSalesOrder(quotationId) {
  const session = await mongoose.startSession();
  try {
    let salesOrder;
    await session.withTransaction(async () => {
      const quotation = await Sale.findById(quotationId).session(session);
      if (!quotation) throw new Error('Quotation not found.');
      if (quotation.status !== 'quotation') throw new Error(`Cannot convert a document with status "${quotation.status}".`);

      // Becoming a sales order is a real commitment now — check and reserve
      // stock, same as createSalesOrder() does for one created directly.
      // Bundle lines expand to their components first.
      const expandedItems = await bundleService.expandItems(quotation.items, session);
      for (const item of expandedItems) {
        await inventoryService.assertSufficientStock(quotation.warehouseId, item.variantId, item.batchId, item.quantity);
      }

      [salesOrder] = await Sale.create(
        [{
          ...quotation.toObject(),
          _id: undefined,
          documentNumber: nextDocumentNumber('SO'),
          status: 'sales_order',
          saleType: 'sales_order',
          convertedFromId: quotation._id,
          createdAt: undefined,
          updatedAt: undefined,
        }],
        { session }
      );

      for (const item of expandedItems) {
        await inventoryService.reserve(quotation.warehouseId, item.variantId, item.batchId, item.quantity, session);
      }

      quotation.status = 'cancelled'; // superseded by the sales order
      await quotation.save({ session });
    });
    return salesOrder;
  } finally {
    session.endSession();
  }
}

/**
 * The actual billing step: validates stock, deducts inventory, posts the
 * accounting voucher, and marks the document completed with a real invoice
 * number — identical effects to PosSaleService.checkout(), just applied to
 * an existing quotation/sales-order document instead of a fresh one.
 *
 * @param {String} saleId - the quotation or sales_order Sale document
 * @param {Object} input - { warehouseId, posTerminalId, payments, revenueAccountId, taxAccountId }
 */
async function convertToInvoice(saleId, input) {
  const session = await mongoose.startSession();
  try {
    let sale;

    await session.withTransaction(async () => {
      sale = await Sale.findById(saleId).session(session);
      if (!sale) throw new Error('Document not found.');
      if (!['quotation', 'sales_order'].includes(sale.status)) {
        throw new Error(`Cannot convert a document with status "${sale.status}" to an invoice.`);
      }

      const {
        warehouseId = sale.warehouseId, posTerminalId, payments = [],
        revenueAccountId, taxAccountId,
      } = input;

      if (!warehouseId) throw new Error('warehouseId is required to convert to an invoice (to deduct stock from).');

      // 1. Validate stock for every line (expanded through bundles). A
      // sales_order already holds a reservation for its own quantity, so
      // ignore reservation when checking availability here — we're about
      // to consume the very reservation this document made, not compete with it.
      const wasReserved = sale.saleType === 'sales_order' && sale.status === 'sales_order';
      const expandedItems = await bundleService.expandItems(sale.items, session);
      for (const item of expandedItems) {
        await inventoryService.assertSufficientStock(
          warehouseId, item.variantId, item.batchId || null, item.quantity,
          { ignoreReservation: wasReserved }
        );
      }

      // 1b. Serial-tracked lines: re-validate at conversion time, not just
      // at creation — availability can change between when a quotation was
      // written and when it's actually invoiced.
      for (const item of sale.items) {
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          await serialInventoryService.assertAvailable(item.variantId, warehouseId, item.serialNumbers, session);
        }
      }

      const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
      const dueAmount = Math.max(sale.totalAmount - paidAmount, 0);
      const invoiceNumber = posTerminalId
        ? await nextInvoiceNumber(posTerminalId, session)
        : nextDocumentNumber('INV');

      sale.warehouseId = warehouseId;
      sale.posTerminalId = posTerminalId || sale.posTerminalId;
      sale.invoiceNumber = invoiceNumber;
      sale.payments = payments;
      sale.paidAmount = paidAmount;
      sale.dueAmount = dueAmount;
      sale.status = 'completed';
      await sale.save({ session });

      // 2. Release the reservation (if any) and deduct real inventory —
      // against the expanded (component-level) lines, same as PosSaleService.
      let cogsTotal = 0;
      for (const item of expandedItems) {
        if (wasReserved) {
          await inventoryService.releaseReservation(warehouseId, item.variantId, item.batchId, item.quantity, session);
        }
        const avgCost = await inventoryService.getAvgCost(warehouseId, item.variantId, item.batchId || null);
        cogsTotal += avgCost * item.quantity;

        await inventoryService.recordMovement({
          companyId: sale.companyId, warehouseId,
          productId: item.productId, variantId: item.variantId, batchId: item.batchId,
          type: 'sale', quantity: -item.quantity,
          referenceType: 'Sale', referenceId: sale._id, userId: sale.userId,
          note: `Sale ${invoiceNumber} (converted from ${sale.documentNumber})`,
        }, session);
      }

      // 2b. Mark specific serial units sold, against the original
      // (unexpanded) sale.items — same reasoning as PosSaleService.
      for (const item of sale.items) {
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          await serialInventoryService.markSold(item.variantId, item.serialNumbers, sale._id, session);
        }
      }

      // 3. Post the accounting voucher — same shape as PosSaleService.checkout(),
      // plus a COGS entry (Dr COGS / Cr Inventory Asset) using the
      // weighted-average cost captured above.
      const revenueAccount = revenueAccountId
        || (await defaultAccountsService.resolve(sale.companyId, 'salesRevenueId', session));

      const entries = [];
      for (const payment of payments) {
        entries.push({ accountId: payment.paymentAccountId, debit: payment.amount, credit: 0 });
      }
      if (revenueAccount) {
        entries.push({ accountId: revenueAccount, debit: 0, credit: sale.subtotal - sale.discountAmount });
      }
      if (sale.taxAmount > 0 && taxAccountId) {
        entries.push({ accountId: taxAccountId, debit: 0, credit: sale.taxAmount });
      }

      if (entries.length > 0 && revenueAccount) {
        await accountingService.postVoucher({
          companyId: sale.companyId, branchId: sale.branchId, type: 'receipt',
          narration: `Invoice ${invoiceNumber} (from ${sale.documentNumber})`,
          entries, referenceType: 'Sale', referenceId: sale._id, userId: sale.userId,
        }, session);
      }

      if (cogsTotal > 0) {
        const cogsAccount = await defaultAccountsService.resolve(sale.companyId, 'costOfGoodsSoldId', session);
        const inventoryAsset = await defaultAccountsService.resolve(sale.companyId, 'inventoryAssetId', session);
        if (cogsAccount && inventoryAsset) {
          await accountingService.postVoucher({
            companyId: sale.companyId, branchId: sale.branchId, type: 'journal',
            narration: `COGS for invoice ${invoiceNumber}`,
            entries: [
              { accountId: cogsAccount, debit: cogsTotal, credit: 0 },
              { accountId: inventoryAsset, debit: 0, credit: cogsTotal },
            ],
            referenceType: 'Sale', referenceId: sale._id, userId: sale.userId,
          }, session);
        }
      }
    });

    return sale;
  } finally {
    session.endSession();
  }
}

async function cancel(saleId) {
  const session = await mongoose.startSession();
  try {
    let sale;
    await session.withTransaction(async () => {
      sale = await Sale.findById(saleId).session(session);
      if (!sale) throw new Error('Document not found.');
      if (!['quotation', 'sales_order'].includes(sale.status)) {
        throw new Error(`Cannot cancel a document with status "${sale.status}".`);
      }

      // Sales orders hold a stock reservation — release it back to available
      // inventory (expanded through bundles). Quotations never reserved
      // anything, so nothing to release.
      if (sale.status === 'sales_order') {
        const expandedItems = await bundleService.expandItems(sale.items, session);
        for (const item of expandedItems) {
          await inventoryService.releaseReservation(sale.warehouseId, item.variantId, item.batchId, item.quantity, session);
        }
      }

      sale.status = 'cancelled';
      await sale.save({ session });
    });
    return sale;
  } finally {
    session.endSession();
  }
}

// Human-friendly labels for the customer-facing summary — internal status
// values (quotation, sales_order, completed, cancelled, returned) stay as
// the source of truth everywhere else in the app; this is presentation only.
const CUSTOMER_STATUS_LABELS = {
  quotation: 'Quotation',
  sales_order: 'Order placed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

/**
 * Customer-safe status summary for the public order-tracking lookup (see
 * publicOrderTrackingRoutes.js / salesOrderController.publicTrackOrder).
 * Deliberately returns ONLY status/tracking-shaped fields — no pricing,
 * cost, payment, or line-item detail, so this is safe to hand back with no
 * staff auth at all as long as the caller already proved they know the
 * order number + the customer's phone (the lookup key IS the auth, same
 * pattern as publicFunnelRoutes.js/publicReviewRoutes.js).
 */
function toPublicStatusSummary(sale) {
  return {
    orderNumber: sale.documentNumber,
    status: sale.status,
    statusLabel: CUSTOMER_STATUS_LABELS[sale.status] || sale.status,
    expectedDeliveryDate: sale.expectedDeliveryDate || null,
    lastUpdatedAt: sale.updatedAt,
  };
}

/**
 * Looks up a sales order by documentNumber + the customer's phone on file
 * (Customer.phone) — the "order number + phone" lookup-key pattern the task
 * calls for as the fallback, since this codebase has no existing per-order
 * public token to reuse. Returns null rather than throwing when nothing
 * matches (a wrong order number and a right order number/wrong phone look
 * identical to the caller — no order/customer enumeration).
 */
async function getPublicOrderStatus(orderNumber, phone) {
  if (!orderNumber || !phone) return null;

  const sale = await Sale.findOne({ documentNumber: orderNumber }).populate('customerId', 'phone');
  if (!sale || !sale.customerId) return null;

  const normalize = (p) => String(p || '').replace(/\D/g, '');
  if (normalize(phone) === '' || normalize(sale.customerId.phone) !== normalize(phone)) return null;

  return toPublicStatusSummary(sale);
}

module.exports = {
  createQuotation, createSalesOrder, convertQuotationToSalesOrder, convertToInvoice, cancel,
  toPublicStatusSummary, getPublicOrderStatus,
};
