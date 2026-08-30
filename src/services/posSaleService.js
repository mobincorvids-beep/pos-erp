/**
 * PosSaleService — orchestrates a checkout: validates stock, creates the Sale,
 * deducts inventory, and posts the accounting voucher, all inside one Mongo
 * transaction so a sale can never exist without its stock/ledger effects
 * (or vice versa).
 */
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Account = require('../models/Account');
const inventoryService = require('./inventoryService');
const accountingService = require('./accountingService');
const bundleService = require('./bundleService');
const serialInventoryService = require('./serialInventoryService');
const defaultAccountsService = require('./defaultAccountsService');
const currencyService = require('./currencyService');
const { nextInvoiceNumber, nextDocumentNumber } = require('./numberingService');
const { computeLineItems } = require('./saleCalculations');
const couponService = require('./couponService');

/**
 * @param {Object} input
 * @param {String} input.companyId
 * @param {String} input.branchId
 * @param {String} input.warehouseId
 * @param {String} [input.posTerminalId]
 * @param {String} [input.customerId]
 * @param {String} input.userId
 * @param {Array} input.items - [{ productId, variantId, batchId?, serialNumbers?, quantity, unitPrice, discountAmount?, taxRate? }]
 *   For serial/IMEI-tracked products, serialNumbers must have exactly one
 *   entry per unit (its length must equal quantity) — each is validated as
 *   in_stock at this warehouse before the sale commits, then marked sold
 *   and linked to it. Omit for non-serial-tracked products.
 * @param {Array} input.payments - [{ paymentAccountId, method, amount }]
 * @param {String} [input.revenueAccountId] - falls back to company's default "Sales Revenue" account
 * @param {String} [input.taxAccountId] - falls back to company's default "Sales Tax Payable" account
 * @param {String} [input.receivableAccountId] - used when part of the sale is on credit
 * @param {String} [input.couponCode] - optional promo code, re-validated server-side and applied as a straight subtraction from totalAmount
 */
async function checkout(input) {
  // Resolved BEFORE the transaction starts, deliberately — getRate() can
  // trigger a live external fetch() call to the Frankfurter API when a
  // rate isn't already cached, and an external HTTP call has no business
  // holding a database transaction open while it waits on another
  // server's response time. Same lesson Hardware's returnRental() already
  // had to learn the hard way earlier in this project, applied here from
  // the start instead of needing to be caught again. Only a plain number
  // (or nothing, when no foreign currency is requested) crosses into the
  // transaction below — no network calls happen inside it.
  let resolvedExchangeRate = null;
  if (input.currency) {
    const Company = require('../models/Company');
    const company = await Company.findById(input.companyId);
    if (company && company.currency && company.currency.toUpperCase() !== input.currency.toUpperCase()) {
      resolvedExchangeRate = await currencyService.getRate(input.companyId, company.currency, input.currency, input.currencyDate);
    }
  }

  const session = await mongoose.startSession();
  try {
    let sale;

    await session.withTransaction(async () => {
      const {
        companyId, branchId, warehouseId, posTerminalId, customerId, userId, projectId, channel,
        items, payments = [], revenueAccountId, taxAccountId, receivableAccountId, couponCode,
      } = input;

      if (!items || items.length === 0) {
        throw new Error('Sale must contain at least one item.');
      }

      // 1. Validate stock availability. Bundle line items are expanded to
      // their components first — a bundle's own "variant" is never in
      // StockLevel, only what it's made of is. Service items (a haircut, a
      // room-night — nothing physical to hold in a warehouse) are excluded
      // by expandItems() itself, not filtered here — see bundleService.js.
      const expandedItems = await bundleService.expandItems(items, session);
      for (const item of expandedItems) {
        await inventoryService.assertSufficientStock(
          warehouseId, item.variantId, item.batchId || null, item.quantity
        );
      }

      // 1b. Serial-tracked lines: validate the exact units requested are
      // actually available before anything else commits. Checked against
      // the ORIGINAL items (not expandedItems) — a bundle is never itself
      // serial-tracked, so this only ever applies to direct lines.
      for (const item of items) {
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          if (item.serialNumbers.length !== item.quantity) {
            throw new Error(`Product ${item.productId}: ${item.serialNumbers.length} serial number(s) provided but quantity is ${item.quantity}, exactly one serial per unit is required.`);
          }
          await serialInventoryService.assertAvailable(item.variantId, warehouseId, item.serialNumbers, session);
        }
      }

      // 2. Compute totals server-side — never trust client-sent totals.
      const { lineItems, subtotal, discountTotal, taxTotal, totalAmount: computedTotal } = computeLineItems(items);

      // 2b. Optional coupon: re-validated here (never trust a client-sent
      // discount amount, same rule as the totals above), a straightforward
      // subtraction from the sale's total since Sale has no other
      // header-level discount field — same "quote, then a separate
      // recordCouponUsage() commits the real effect" shape
      // loyaltyService.redeemPoints() already follows for points.
      let couponDiscountAmount = 0;
      let appliedCoupon = null;
      if (couponCode) {
        const result = await couponService.validateCoupon(companyId, couponCode, {
          customerId, purchaseAmount: computedTotal,
        });
        appliedCoupon = result.coupon;
        couponDiscountAmount = Math.min(result.discountAmount, computedTotal);
      }
      const totalAmount = Math.round((computedTotal - couponDiscountAmount) * 100) / 100;
      const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
      const dueAmount = Math.max(totalAmount - paidAmount, 0);

      const invoiceNumber = posTerminalId
        ? await nextInvoiceNumber(posTerminalId, session)
        : nextDocumentNumber('INV');

      // 3. Create the sale document. currency/exchangeRate/foreignTotalAmount
      // are display-only — totalAmount and every other monetary field
      // above remain in the company's BASE currency always, since that's
      // what accounting/vouchers/reports assume everywhere else in this
      // app; resolvedExchangeRate was already computed BEFORE this
      // transaction started (see above), so this is pure arithmetic, no
      // network call happening here.
      [sale] = await Sale.create(
        [{
          companyId, branchId, warehouseId, posTerminalId, customerId, userId, projectId: projectId || null,
          documentNumber: invoiceNumber, invoiceNumber, status: 'completed', saleType: 'pos', channel: channel || 'pos',
          items: lineItems, payments,
          subtotal, discountAmount: discountTotal, taxAmount: taxTotal,
          totalAmount, paidAmount, dueAmount,
          couponCode: appliedCoupon ? appliedCoupon.code : null,
          couponDiscountAmount,
          currency: resolvedExchangeRate ? input.currency.toUpperCase() : null,
          exchangeRate: resolvedExchangeRate || 1,
          foreignTotalAmount: resolvedExchangeRate ? Math.round(totalAmount * resolvedExchangeRate * 100) / 100 : null,
        }],
        { session }
      );

      // 4. Deduct inventory for each EXPANDED (component-level) line via the
      // ledger-backed InventoryService — service lines never reached this
      // list at all (see bundleService.expandItems), so no special-casing
      // is needed here. Sale.items still stores the bundle itself for
      // correct pricing/reporting on the invoice — only the stock effect is expanded.
      let cogsTotal = 0;
      for (const item of expandedItems) {
        const avgCost = await inventoryService.getAvgCost(warehouseId, item.variantId, item.batchId || null);
        cogsTotal += avgCost * item.quantity;

        await inventoryService.recordMovement({
          companyId, warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          batchId: item.batchId,
          type: 'sale',
          quantity: -item.quantity, // stock out
          referenceType: 'Sale',
          referenceId: sale._id,
          userId,
          note: `Sale ${invoiceNumber}`,
        }, session);
      }

      // 4b. Mark the specific serial units sold and link them to this sale
      // — done against lineItems (the original, unexpanded lines), same
      // reasoning as the 1b validation step above.
      for (const item of lineItems) {
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          await serialInventoryService.markSold(item.variantId, item.serialNumbers, sale._id, session);
        }
      }

      // 5. Post the accounting voucher: Dr Cash/Bank/Receivable, Cr Revenue + Tax Payable.
      const revenueAccount = revenueAccountId
        || (await defaultAccountsService.resolve(companyId, 'salesRevenueId', session));

      const entries = [];
      for (const payment of payments) {
        entries.push({ accountId: payment.paymentAccountId, debit: payment.amount, credit: 0 });
      }
      if (dueAmount > 0) {
        // Falls back to the company's default Accounts Receivable account,
        // the same way revenueAccount/taxAccount already do — without this,
        // any partial-payment sale that didn't pass receivableAccountId
        // explicitly produced an unbalanced voucher (debits short by
        // exactly dueAmount), since the credit side always posts the FULL
        // subtotal regardless.
        const receivable = receivableAccountId
          || (await defaultAccountsService.resolve(companyId, 'accountsReceivableId', session));
        if (receivable) {
          entries.push({ accountId: receivable, debit: dueAmount, credit: 0 });
        }
      }
      if (revenueAccount) {
        // Coupon discount reduces recognized revenue the same way per-line
        // discounts already do — this is what keeps the voucher balanced
        // against the (now coupon-reduced) totalAmount above.
        entries.push({ accountId: revenueAccount, debit: 0, credit: subtotal - discountTotal - couponDiscountAmount });
      }
      if (taxTotal > 0 && taxAccountId) {
        entries.push({ accountId: taxAccountId, debit: 0, credit: taxTotal });
      }

      if (entries.length > 0 && revenueAccount) {
        await accountingService.postVoucher({
          companyId, branchId, type: 'receipt', narration: `POS Sale ${invoiceNumber}`,
          entries, referenceType: 'Sale', referenceId: sale._id, userId,
        }, session);
      }

      // 6. COGS: Dr Cost of Goods Sold, Cr Inventory Asset — only posted if
      // both accounts exist (see reportingService/purchaseService for the
      // same name-based fallback pattern); otherwise inventory is still
      // correctly deducted above, just without the matching P&L entry.
      if (cogsTotal > 0) {
        const cogsAccount = await defaultAccountsService.resolve(companyId, 'costOfGoodsSoldId', session);
        const inventoryAsset = await defaultAccountsService.resolve(companyId, 'inventoryAssetId', session);
        if (cogsAccount && inventoryAsset) {
          await accountingService.postVoucher({
            companyId, branchId, type: 'journal', narration: `COGS for sale ${invoiceNumber}`,
            entries: [
              { accountId: cogsAccount, debit: cogsTotal, credit: 0 },
              { accountId: inventoryAsset, debit: 0, credit: cogsTotal },
            ],
            referenceType: 'Sale', referenceId: sale._id, userId,
          }, session);
        }
      }
    });

    // Coupon usage is recorded only now, after the sale has genuinely
    // committed — never inside the transaction above, so a coupon can
    // never be marked "used" for a sale that didn't actually go through.
    // Best-effort: a failure here must never undo or fail the sale that
    // already completed (same rule the webhook calls below already follow).
    if (sale.couponCode) {
      try {
        const coupon = await require('../models/Coupon').findOne({ companyId: sale.companyId, code: sale.couponCode });
        if (coupon) {
          await couponService.recordCouponUsage(coupon._id, {
            companyId: sale.companyId, customerId: sale.customerId || null,
            saleId: sale._id, discountAmount: sale.couponDiscountAmount,
          });
        }
      } catch (err) {
        console.error('Recording coupon usage failed (sale itself still succeeded):', err.message);
      }
    }

    // Fired AFTER the transaction has fully committed, deliberately outside
    // it — an external HTTP call (which is exactly what firing a webhook
    // is) has no business holding a database transaction open while it
    // waits on some other server's response time. Wrapped so a failed or
    // slow webhook delivery can never affect the sale that already
    // completed successfully — same "the real operation matters more than
    // the notification about it" principle the low-stock check already established.
    try {
      await require('./webhookService').fire(input.companyId, 'sale.completed', {
        saleId: sale._id, invoiceNumber: sale.invoiceNumber, totalAmount: sale.totalAmount, branchId: sale.branchId,
      });
    } catch (err) {
      console.error('Webhook delivery for sale.completed failed (sale itself still succeeded):', err.message);
    }

    // Developer Platform's outbound webhook (separate subscription system
    // from the one above — see DeveloperWebhookSubscription's header
    // comment for why they're kept distinct). Same fire-and-forget rule:
    // a third party's endpoint being slow or down must never affect a
    // sale that already completed successfully.
    try {
      await require('./webhookSubscriptionService').triggerWebhook(String(input.companyId), 'sale.created', {
        saleId: sale._id, invoiceNumber: sale.invoiceNumber, totalAmount: sale.totalAmount, branchId: sale.branchId,
      });
    } catch (err) {
      console.error('Developer Platform webhook delivery for sale.created failed (sale itself still succeeded):', err.message);
    }

    return sale;
  } finally {
    session.endSession();
  }
}

module.exports = { checkout };
