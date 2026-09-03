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
const creditLimitService = require('./creditLimitService');
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

  // Order holds (credit): a sales order that would push the customer's
  // outstanding balance over their Customer.creditLimit is created anyway
  // (additive, not a hard block like posSaleService.checkout's) but with
  // holdStatus set to credit_hold, so it can't proceed to
  // fulfillment/picking/invoicing until released — see
  // convertToInvoice()'s hold check and releaseOrderHold() below. Computed
  // before the transaction (a plain read, same "no network/heavy work
  // inside the transaction" discipline as posSaleService.checkout).
  let holdFields = { holdStatus: 'none', holdReason: null, heldBy: null, heldAt: null };
  if (customerId) {
    const check = await creditLimitService.checkCreditLimit(customerId, totalAmount);
    if (check.exceeds) {
      holdFields = {
        holdStatus: 'credit_hold',
        holdReason: `Order total ${totalAmount.toFixed(2)} would put the customer's outstanding balance at ${check.projectedBalance.toFixed(2)}, over their credit limit of ${check.creditLimit.toFixed(2)}.`,
        heldBy: null, // system-placed, not a person
        heldAt: new Date(),
      };
    }
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
          ...holdFields,
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
      if (sale.holdStatus && sale.holdStatus !== 'none') {
        throw new Error(`This order is on hold (${sale.holdStatus}: ${sale.holdReason || 'no reason given'}) and cannot be converted to an invoice until the hold is released.`);
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

/**
 * Places a hold on an order directly (fraud review or a manual/staff-
 * initiated hold) — distinct from the automatic credit_hold createDraft()
 * applies. type must be 'fraud_review' or 'manual_hold' (credit_hold is
 * system-only, never placed by a person through this endpoint).
 */
async function placeOrderHold(saleId, { type, reason, userId }) {
  if (!['fraud_review', 'manual_hold'].includes(type)) {
    throw new Error('type must be "fraud_review" or "manual_hold".');
  }
  const sale = await Sale.findById(saleId);
  if (!sale) throw new Error('Order not found.');
  sale.holdStatus = type;
  sale.holdReason = reason || null;
  sale.heldBy = userId || null;
  sale.heldAt = new Date();
  sale.releasedBy = null;
  sale.releasedAt = null;
  await sale.save();
  return sale;
}

/** Releases whatever hold (credit_hold, fraud_review, manual_hold) is on an order, letting it proceed to fulfillment/invoicing again. */
async function releaseOrderHold(saleId, { userId, note } = {}) {
  const sale = await Sale.findById(saleId);
  if (!sale) throw new Error('Order not found.');
  if (!sale.holdStatus || sale.holdStatus === 'none') throw new Error('This order is not on hold.');
  sale.holdStatus = 'none';
  sale.holdReason = note ? `${sale.holdReason || ''} — released: ${note}`.trim() : sale.holdReason;
  sale.releasedBy = userId || null;
  sale.releasedAt = new Date();
  await sale.save();
  return sale;
}

// Maps a Sale document's saleType/channel/status onto one label a
// consolidated cross-channel order view can group/filter by, without
// requiring the frontend to know this codebase's internal field layout.
// POS/ecommerce are tagged directly via `channel`; sales orders/
// quotations are their own saleType regardless of channel. Route sales and
// secondary (sell-through) sales do not create Sale documents in this
// codebase today (see routeSalesService/secondarySaleService — they track
// visits/sell-through numbers, not invoices), so they never appear in this
// list; the shape below still reserves a place for them once/if they do.
function resolveOrderChannel(sale) {
  if (sale.saleType === 'sales_order' || sale.saleType === 'quotation') return 'sales_order';
  return sale.channel || 'pos';
}

/**
 * Consolidated, cross-channel order list — POS, sales orders/quotations,
 * and e-commerce (including per-SalesChannel imports, which are tagged
 * channel:'ecommerce' the same as the single-channel integration; see
 * ecommerceService.importOrder) in one unified shape, so the frontend
 * doesn't need to query each source separately.
 *
 * @param {String} companyId
 * @param {Object} [opts]
 * @param {String} [opts.channel] - 'pos' | 'ecommerce' | 'sales_order' (see resolveOrderChannel)
 * @param {String} [opts.status] - Sale.status value
 * @param {String|Date} [opts.from] - invoiceDate lower bound
 * @param {String|Date} [opts.to] - invoiceDate upper bound
 */
async function getConsolidatedOrders(companyId, { channel, status, from, to } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (from || to) {
    filter.invoiceDate = {};
    if (from) filter.invoiceDate.$gte = new Date(from);
    if (to) filter.invoiceDate.$lte = new Date(to);
  }
  if (channel === 'sales_order') {
    filter.saleType = { $in: ['sales_order', 'quotation'] };
  } else if (channel) {
    filter.channel = channel;
    filter.saleType = { $nin: ['sales_order', 'quotation'] };
  }

  const sales = await Sale.find(filter).sort({ invoiceDate: -1, createdAt: -1 }).limit(500)
    .populate('customerId', 'name phone email');

  return sales.map((sale) => ({
    id: sale._id,
    documentNumber: sale.documentNumber,
    invoiceNumber: sale.invoiceNumber,
    orderChannel: resolveOrderChannel(sale),
    saleType: sale.saleType,
    channel: sale.channel,
    status: sale.status,
    holdStatus: sale.holdStatus,
    customer: sale.customerId ? { id: sale.customerId._id, name: sale.customerId.name, phone: sale.customerId.phone, email: sale.customerId.email } : null,
    totalAmount: sale.totalAmount,
    dueAmount: sale.dueAmount,
    itemCount: sale.items.length,
    invoiceDate: sale.invoiceDate,
    expectedDeliveryDate: sale.expectedDeliveryDate,
    updatedAt: sale.updatedAt,
  }));
}

/**
 * Splits a subset of an order's line items into a new Sale document
 * (splitFromOrderId links back), e.g. for partial-warehouse-fulfillment —
 * one part ships now, the rest waits. Only allowed on a document that
 * hasn't been billed yet (quotation/sales_order). lineItemAllocations:
 * [{ variantId, batchId?, quantity }] — quantity split OUT of the
 * original order into the new one; must not exceed what's left on that
 * line. Reservations move with the split quantity when the original was a
 * reserved sales order.
 */
async function splitOrder(saleId, { lineItemAllocations }) {
  if (!lineItemAllocations || lineItemAllocations.length === 0) {
    throw new Error('lineItemAllocations must contain at least one item.');
  }

  const session = await mongoose.startSession();
  try {
    let newSale;
    await session.withTransaction(async () => {
      const original = await Sale.findById(saleId).session(session);
      if (!original) throw new Error('Order not found.');
      if (!['quotation', 'sales_order'].includes(original.status)) {
        throw new Error(`Cannot split a document with status "${original.status}".`);
      }

      const remainingItems = original.items.map((i) => i.toObject());
      const newItems = [];

      for (const alloc of lineItemAllocations) {
        const idx = remainingItems.findIndex((i) =>
          String(i.variantId) === String(alloc.variantId) && String(i.batchId || '') === String(alloc.batchId || '')
        );
        if (idx === -1) throw new Error(`Item ${alloc.variantId} is not on this order.`);
        const line = remainingItems[idx];
        if (alloc.quantity <= 0 || alloc.quantity > line.quantity) {
          throw new Error(`Cannot split ${alloc.quantity} of a line with only ${line.quantity} on the order.`);
        }

        const unitShare = alloc.quantity / line.quantity;
        const splitLine = {
          ...line,
          quantity: alloc.quantity,
          discountAmount: line.discountAmount * unitShare,
          taxAmount: line.taxAmount * unitShare,
          lineTotal: line.lineTotal * unitShare,
          serialNumbers: (line.serialNumbers || []).slice(0, alloc.quantity),
        };
        newItems.push(splitLine);

        if (alloc.quantity === line.quantity) {
          remainingItems.splice(idx, 1);
        } else {
          line.quantity -= alloc.quantity;
          line.serialNumbers = (line.serialNumbers || []).slice(alloc.quantity);
          line.discountAmount -= splitLine.discountAmount;
          line.taxAmount -= splitLine.taxAmount;
          line.lineTotal -= splitLine.lineTotal;
        }
      }
      if (remainingItems.length === 0) throw new Error('Cannot split every line off an order — nothing would remain on the original.');

      const sumOf = (items, key) => items.reduce((s, i) => s + i[key], 0);
      const recompute = (items) => ({
        subtotal: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
        discountAmount: sumOf(items, 'discountAmount'),
        taxAmount: sumOf(items, 'taxAmount'),
        totalAmount: sumOf(items, 'lineTotal'),
      });

      const newTotals = recompute(newItems);
      const remainingTotals = recompute(remainingItems);

      [newSale] = await Sale.create(
        [{
          companyId: original.companyId, branchId: original.branchId, warehouseId: original.warehouseId,
          customerId: original.customerId, userId: original.userId,
          documentNumber: nextDocumentNumber(original.saleType === 'quotation' ? 'QUO' : 'SO'),
          status: original.status, saleType: original.saleType,
          items: newItems, ...newTotals,
          paidAmount: 0, dueAmount: newTotals.totalAmount,
          splitFromOrderId: original._id,
        }],
        { session }
      );

      original.items = remainingItems;
      Object.assign(original, remainingTotals);
      original.dueAmount = Math.max(remainingTotals.totalAmount - original.paidAmount, 0);
      await original.save({ session });
    });
    return newSale;
  } finally {
    session.endSession();
  }
}

/**
 * Merges multiple pending (quotation/sales_order) orders from the same
 * customer into one combined order, only allowed pre-fulfillment (neither
 * this nor any invoicing has happened yet). The first order in saleIds is
 * kept and absorbs the others' line items; the rest are marked cancelled
 * with a note pointing at the survivor.
 */
async function mergeOrders(saleIds, targetCustomerId) {
  if (!saleIds || saleIds.length < 2) throw new Error('mergeOrders needs at least two saleIds.');

  const session = await mongoose.startSession();
  try {
    let survivor;
    await session.withTransaction(async () => {
      const orders = await Sale.find({ _id: { $in: saleIds } }).session(session);
      if (orders.length !== saleIds.length) throw new Error('One or more orders were not found.');

      for (const order of orders) {
        if (!['quotation', 'sales_order'].includes(order.status)) {
          throw new Error(`Order ${order.documentNumber} has status "${order.status}" and can't be merged (only pending quotations/sales orders can be merged).`);
        }
        if (String(order.customerId) !== String(targetCustomerId)) {
          throw new Error(`Order ${order.documentNumber} does not belong to the target customer.`);
        }
      }

      const ordered = saleIds.map((id) => orders.find((o) => String(o._id) === String(id)));
      [survivor] = ordered;
      const rest = ordered.slice(1);

      for (const order of rest) {
        survivor.items.push(...order.items.map((i) => i.toObject()));
      }
      survivor.subtotal = survivor.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      survivor.discountAmount = survivor.items.reduce((s, i) => s + i.discountAmount, 0);
      survivor.taxAmount = survivor.items.reduce((s, i) => s + i.taxAmount, 0);
      survivor.totalAmount = survivor.items.reduce((s, i) => s + i.lineTotal, 0);
      survivor.dueAmount = Math.max(survivor.totalAmount - survivor.paidAmount, 0);
      await survivor.save({ session });

      for (const order of rest) {
        order.status = 'cancelled';
        order.holdReason = `Merged into order ${survivor.documentNumber}.`;
        await order.save({ session });
      }
    });
    return survivor;
  } finally {
    session.endSession();
  }
}

module.exports = {
  createQuotation, createSalesOrder, convertQuotationToSalesOrder, convertToInvoice, cancel,
  toPublicStatusSummary, getPublicOrderStatus,
  placeOrderHold, releaseOrderHold, getConsolidatedOrders,
  splitOrder, mergeOrders,
};
