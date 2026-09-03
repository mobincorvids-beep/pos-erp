/**
 * SupplierLedgerService — mirror of CustomerLedgerService for accounts
 * payable: PurchaseOrder.dueAmount (credit, company owes) and
 * SupplierPayment (debit, reduces what's owed), derived on read rather than
 * a separate ledger table.
 */
const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const SupplierPayment = require('../models/SupplierPayment');
const PurchaseOrder = require('../models/PurchaseOrder');
const Account = require('../models/Account');
const accountingService = require('./accountingService');
const defaultAccountsService = require('./defaultAccountsService');

/**
 * @param {Object} input
 * @param {String} input.companyId
 * @param {String} input.supplierId
 * @param {String} input.paymentAccountId
 * @param {Number} input.amount
 * @param {Array} [input.allocations] - [{ purchaseOrderId, amount }]; auto-allocated oldest-first if omitted
 * @param {String} [input.payableAccountId] - falls back to a company "Accounts Payable" account
 */
async function recordPayment(input) {
  const session = await mongoose.startSession();
  try {
    let payment;

    await session.withTransaction(async () => {
      const {
        companyId, supplierId, paymentAccountId, amount, date, note, userId,
        payableAccountId, method, reference,
      } = input;

      if (!amount || amount <= 0) throw new Error('Payment amount must be greater than zero.');

      let allocations = input.allocations;
      if (!allocations || allocations.length === 0) {
        const duePOs = await PurchaseOrder.find({
          companyId, supplierId, dueAmount: { $gt: 0 },
        }).sort({ createdAt: 1 }).session(session);

        allocations = [];
        let remaining = amount;
        for (const po of duePOs) {
          if (remaining <= 0) break;
          const applied = Math.min(remaining, po.dueAmount);
          allocations.push({ purchaseOrderId: po._id, amount: applied });
          remaining -= applied;
        }
      }

      const allocatedTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
      if (allocatedTotal > amount + 0.01) {
        throw new Error('Allocated amount cannot exceed the payment amount.');
      }

      for (const alloc of allocations) {
        const po = await PurchaseOrder.findById(alloc.purchaseOrderId).session(session);
        if (!po) throw new Error(`Purchase order ${alloc.purchaseOrderId} not found.`);
        if (alloc.amount > po.dueAmount + 0.01) {
          throw new Error(`Allocation of ${alloc.amount} exceeds due amount ${po.dueAmount} on PO ${po.poNumber}.`);
        }
        po.dueAmount -= alloc.amount;
        po.paidAmount += alloc.amount;
        await po.save({ session });
      }

      [payment] = await SupplierPayment.create(
        [{ companyId, supplierId, paymentAccountId, amount, date: date || new Date(), allocations, note, userId, method: method || 'cash', reference: reference || null }],
        { session }
      );

      const payable = payableAccountId
        || (await defaultAccountsService.resolve(companyId, 'accountsPayableId', session));

      if (payable) {
        const voucher = await accountingService.postVoucher({
          companyId, type: 'payment', date: date || new Date(),
          narration: `Payment made to supplier`,
          entries: [
            { accountId: payable, debit: amount, credit: 0 },
            { accountId: paymentAccountId, debit: 0, credit: amount },
          ],
          referenceType: 'SupplierPayment', referenceId: payment._id, userId,
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

async function ledger(supplierId) {
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) throw new Error('Supplier not found.');

  const purchaseOrders = await PurchaseOrder.find({
    supplierId, status: { $in: ['received', 'partially_received'] },
  }).sort({ createdAt: 1 });
  const payments = await SupplierPayment.find({ supplierId }).sort({ date: 1 });

  // Mirror of the same fix in customerLedgerService: the full received
  // amount (paidAmount + dueAmount) is what's owed, but whatever was
  // settled immediately at receiving time (paidAmount, e.g. a cash
  // purchase paid on the spot) needs an offsetting debit right alongside
  // it — otherwise an already-paid GRN would show as still owed forever,
  // since only later SupplierPayment records were being debited here before.
  const entries = [
    ...purchaseOrders.flatMap((po) => {
      const owed = po.paidAmount + po.dueAmount;
      const rows = [{ date: po.createdAt, type: 'purchase', reference: po.poNumber, debit: 0, credit: owed }];
      if (po.paidAmount > 0) {
        rows.push({ date: po.createdAt, type: 'purchase_payment', reference: po.poNumber, debit: po.paidAmount, credit: 0 });
      }
      return rows;
    }),
    // A reversed (bounced-cheque-to-supplier) payment stops counting as
    // money paid out — mirror of the same fix in customerLedgerService.
    ...payments.filter((p) => !p.reversed).map((p) => ({
      date: p.date, type: 'payment', reference: String(p._id),
      debit: p.amount, credit: 0,
    })),
    ...payments.filter((p) => p.reversed).map((p) => ({
      date: p.reversedAt || p.date, type: 'payment_reversed', reference: String(p._id),
      debit: 0, credit: p.amount,
    })),
  ].sort((a, b) => a.date - b.date);

  let balance = supplier.openingBalance;
  const rows = entries.map((e) => {
    balance += e.credit - e.debit; // +ve = company owes supplier
    return { ...e, balance };
  });

  return { supplierId, openingBalance: supplier.openingBalance, entries: rows, closingBalance: balance };
}

/** Outstanding payable per supplier, bucketed by days since the PO was received. */
async function agingReport(companyId) {
  const duePOs = await PurchaseOrder.find({ companyId, dueAmount: { $gt: 0 } })
    .populate('supplierId', 'name phone');

  const now = new Date();
  const bySupplier = new Map();

  for (const po of duePOs) {
    const days = Math.floor((now - po.createdAt) / (1000 * 60 * 60 * 24));
    const bucket = days <= 30 ? 'current' : days <= 60 ? 'days31to60' : days <= 90 ? 'days61to90' : 'over90';

    const key = String(po.supplierId?._id || 'unknown');
    if (!bySupplier.has(key)) {
      bySupplier.set(key, {
        supplierId: po.supplierId?._id || null,
        supplierName: po.supplierId?.name || 'Unknown',
        current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0,
      });
    }
    const row = bySupplier.get(key);
    row[bucket] += po.dueAmount;
    row.total += po.dueAmount;
  }

  return Array.from(bySupplier.values()).sort((a, b) => b.total - a.total);
}

/**
 * Reverses a previously recorded SupplierPayment — used when a cheque the
 * company wrote to a supplier bounces. Mirror of
 * customerLedgerService.reversePayment: restores each allocated PO's
 * dueAmount/paidAmount, posts a compensating voucher (Dr the original
 * payment account, Cr Accounts Payable), and flags the payment so
 * ledger() stops treating it as money paid. Idempotent.
 */
async function reversePayment(paymentId, companyId, opts = {}) {
  const session = await mongoose.startSession();
  try {
    let payment;
    await session.withTransaction(async () => {
      payment = await SupplierPayment.findOne({ _id: paymentId, companyId }).session(session);
      if (!payment) throw new Error('Supplier payment not found.');
      if (payment.reversed) return;

      for (const alloc of payment.allocations) {
        const po = await PurchaseOrder.findById(alloc.purchaseOrderId).session(session);
        if (!po) continue;
        po.dueAmount += alloc.amount;
        po.paidAmount -= alloc.amount;
        await po.save({ session });
      }

      payment.reversed = true;
      payment.reversedAt = new Date();
      await payment.save({ session });

      const payable = opts.payableAccountId
        || (await defaultAccountsService.resolve(companyId, 'accountsPayableId', session));
      if (payable) {
        const voucher = await accountingService.postVoucher({
          companyId, type: 'journal', date: new Date(),
          narration: opts.narration || `Reversal of supplier payment ${payment._id}`,
          entries: [
            { accountId: payment.paymentAccountId, debit: payment.amount, credit: 0 },
            { accountId: payable, debit: 0, credit: payment.amount },
          ],
          referenceType: 'SupplierPayment', referenceId: payment._id, userId: opts.userId,
        }, session);
        payment.reversalVoucherId = voucher._id;
        await payment.save({ session });
      }
    });
    return payment;
  } finally {
    session.endSession();
  }
}

module.exports = { recordPayment, reversePayment, ledger, agingReport };
