/**
 * CustomerLedgerService — the "Customer Ledger / Credit / Aging" module from
 * the proposal. Deliberately NOT its own chart-of-accounts subsidiary ledger
 * (that would mean one Account per customer, which doesn't scale); instead
 * the ledger is derived on read from Sale (debits) and CustomerPayment
 * (credits), which is the standard "AR subledger" pattern most POS/ERP
 * systems use under the hood regardless of what the UI shows.
 */
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const CustomerPayment = require('../models/CustomerPayment');
const Sale = require('../models/Sale');
const Account = require('../models/Account');
const accountingService = require('./accountingService');
const defaultAccountsService = require('./defaultAccountsService');

/**
 * Records a receipt from a customer and applies it against specific unpaid
 * sales (oldest-first if no allocations given), reducing each sale's
 * dueAmount and posting Dr Cash/Bank, Cr Accounts Receivable.
 *
 * @param {Object} input
 * @param {String} input.companyId
 * @param {String} input.customerId
 * @param {String} input.paymentAccountId
 * @param {Number} input.amount
 * @param {Array} [input.allocations] - [{ saleId, amount }]; auto-allocated oldest-first if omitted
 * @param {String} [input.receivableAccountId] - falls back to a company "Accounts Receivable" account
 */
async function recordPayment(input) {
  const session = await mongoose.startSession();
  try {
    let payment;

    await session.withTransaction(async () => {
      const {
        companyId, customerId, paymentAccountId, amount, date, note, userId,
        receivableAccountId,
      } = input;

      if (!amount || amount <= 0) throw new Error('Payment amount must be greater than zero.');

      let allocations = input.allocations;
      if (!allocations || allocations.length === 0) {
        // Auto-allocate oldest-first against sales with an outstanding due amount.
        const dueSales = await Sale.find({
          companyId, customerId, dueAmount: { $gt: 0 }, status: 'completed',
        }).sort({ createdAt: 1 }).session(session);

        allocations = [];
        let remaining = amount;
        for (const sale of dueSales) {
          if (remaining <= 0) break;
          const applied = Math.min(remaining, sale.dueAmount);
          allocations.push({ saleId: sale._id, amount: applied });
          remaining -= applied;
        }
      }

      const allocatedTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
      if (allocatedTotal > amount + 0.01) {
        throw new Error('Allocated amount cannot exceed the payment amount.');
      }

      for (const alloc of allocations) {
        const sale = await Sale.findById(alloc.saleId).session(session);
        if (!sale) throw new Error(`Sale ${alloc.saleId} not found.`);
        if (alloc.amount > sale.dueAmount + 0.01) {
          throw new Error(`Allocation of ${alloc.amount} exceeds due amount ${sale.dueAmount} on sale ${sale.documentNumber}.`);
        }
        sale.dueAmount -= alloc.amount;
        sale.paidAmount += alloc.amount;
        await sale.save({ session });
      }

      [payment] = await CustomerPayment.create(
        [{ companyId, customerId, paymentAccountId, amount, date: date || new Date(), allocations, note, userId }],
        { session }
      );

      const receivable = receivableAccountId
        || (await defaultAccountsService.resolve(companyId, 'accountsReceivableId', session));

      if (receivable) {
        const voucher = await accountingService.postVoucher({
          companyId, type: 'receipt', date: date || new Date(),
          narration: `Payment received from customer`,
          entries: [
            { accountId: paymentAccountId, debit: amount, credit: 0 },
            { accountId: receivable, debit: 0, credit: amount },
          ],
          referenceType: 'CustomerPayment', referenceId: payment._id, userId,
        }, session);
        payment.voucherId = voucher._id;
        await payment.save({ session });
      }
    });

    return payment;
  } finally {
    session.endSession();
  }
}

/**
 * Chronological ledger for one customer: every sale (debit) and payment
 * (credit), with a running balance starting from the customer's opening balance.
 */
async function ledger(customerId) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error('Customer not found.');

  const sales = await Sale.find({ customerId, status: 'completed' }).sort({ createdAt: 1 });
  const payments = await CustomerPayment.find({ customerId }).sort({ date: 1 });

  // A sale's full totalAmount is always the debit (the invoice value), but
  // whatever was paid AT CHECKOUT (Sale.paidAmount, e.g. a cash sale paid
  // in full on the spot) has to be credited right alongside it — otherwise
  // a fully-paid-at-checkout sale would show as permanently owed, since
  // only later CustomerPayment records were being credited here before.
  const entries = [
    ...sales.flatMap((s) => {
      const rows = [{
        date: s.createdAt, type: 'sale', reference: s.invoiceNumber || s.documentNumber,
        debit: s.totalAmount, credit: 0,
      }];
      if (s.paidAmount > 0) {
        rows.push({
          date: s.createdAt, type: 'sale_payment', reference: s.invoiceNumber || s.documentNumber,
          debit: 0, credit: s.paidAmount,
        });
      }
      return rows;
    }),
    ...payments.map((p) => ({
      date: p.date, type: 'payment', reference: String(p._id),
      debit: 0, credit: p.amount,
    })),
  ].sort((a, b) => a.date - b.date);

  let balance = customer.openingBalance;
  const rows = entries.map((e) => {
    balance += e.debit - e.credit;
    return { ...e, balance };
  });

  return { customerId, openingBalance: customer.openingBalance, entries: rows, closingBalance: balance };
}

/** Outstanding balance per customer, bucketed by days since the sale (0-30 / 31-60 / 61-90 / 90+). */
async function agingReport(companyId) {
  const dueSales = await Sale.find({ companyId, dueAmount: { $gt: 0 }, status: 'completed' })
    .populate('customerId', 'name phone');

  const now = new Date();
  const byCustomer = new Map();

  for (const sale of dueSales) {
    const days = Math.floor((now - sale.createdAt) / (1000 * 60 * 60 * 24));
    const bucket = days <= 30 ? 'current' : days <= 60 ? 'days31to60' : days <= 90 ? 'days61to90' : 'over90';

    const key = String(sale.customerId?._id || 'walk-in');
    if (!byCustomer.has(key)) {
      byCustomer.set(key, {
        customerId: sale.customerId?._id || null,
        customerName: sale.customerId?.name || 'Walk-in',
        current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0,
      });
    }
    const row = byCustomer.get(key);
    row[bucket] += sale.dueAmount;
    row.total += sale.dueAmount;
  }

  return Array.from(byCustomer.values()).sort((a, b) => b.total - a.total);
}

module.exports = { recordPayment, ledger, agingReport };
