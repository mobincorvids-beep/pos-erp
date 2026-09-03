/**
 * ChequeService — cheque tracking for the Pakistani retail/wholesale
 * market, where cheques (both received from customers and issued to
 * suppliers) are a routine tender alongside cash and mobile wallets.
 *
 * Recording a cheque payment goes through the SAME recordPayment() path
 * customer/supplierLedgerService already use for cash/bank/gateway
 * payments (method: 'cheque') — dueAmount/paidAmount and the receipt/
 * payment voucher are posted exactly the same way a cash payment would be,
 * because a deposited cheque IS money received/paid the moment it's
 * recorded, same as this app already treats a card swipe. What's
 * cheque-specific is layered on top here: the Cheque row itself (bank,
 * cheque number, due date, clearance status) and what happens when one
 * bounces — reversing the payment's ledger effect via
 * customer/supplierLedgerService.reversePayment, the same reversal seam a
 * bounced/dishonored receipt would need for any tender.
 */
const Cheque = require('../models/Cheque');
const customerLedgerService = require('./customerLedgerService');
const supplierLedgerService = require('./supplierLedgerService');

/**
 * Records a cheque received from a customer against their outstanding
 * sales (or a supplier cheque issued against outstanding purchase orders).
 *
 * @param {Object} input
 * @param {String} input.companyId
 * @param {'receivable'|'payable'} input.direction
 * @param {String} [input.customerId] - required for direction 'receivable'
 * @param {String} [input.supplierId] - required for direction 'payable'
 * @param {String} input.paymentAccountId - the bank/cash account the cheque is deposited into (receivable) or drawn from (payable)
 * @param {Number} input.amount
 * @param {String} input.chequeNumber
 * @param {String} input.bankName
 * @param {Date|String} input.chequeDate
 * @param {Date|String} [input.dueDate] - defaults to chequeDate
 * @param {Array} [input.allocations] - [{ saleId, amount }] or [{ purchaseOrderId, amount }]; auto-allocated oldest-first if omitted
 * @param {String} [input.note]
 * @param {String} [input.userId]
 */
async function recordChequePayment(input) {
  const {
    companyId, direction, customerId, supplierId, paymentAccountId, amount,
    chequeNumber, bankName, chequeDate, dueDate, allocations, note, userId,
  } = input;

  if (!['receivable', 'payable'].includes(direction)) {
    throw new Error("direction must be 'receivable' or 'payable'.");
  }
  if (!chequeNumber || !bankName || !chequeDate) {
    throw new Error('chequeNumber, bankName and chequeDate are required.');
  }
  if (!amount || amount <= 0) throw new Error('Amount must be greater than zero.');

  let cheque;
  if (direction === 'receivable') {
    if (!customerId) throw new Error('customerId is required for a receivable cheque.');
    const payment = await customerLedgerService.recordPayment({
      companyId, customerId, paymentAccountId, amount, allocations, note, userId,
      method: 'cheque', date: chequeDate,
    });
    cheque = await Cheque.create({
      companyId, direction, customerId, customerPaymentId: payment._id,
      chequeNumber, bankName, chequeDate, dueDate: dueDate || chequeDate,
      amount, note, userId,
    });
    payment.reference = String(cheque._id);
    await payment.save();
  } else {
    if (!supplierId) throw new Error('supplierId is required for a payable cheque.');
    const payment = await supplierLedgerService.recordPayment({
      companyId, supplierId, paymentAccountId, amount, allocations, note, userId,
      method: 'cheque', date: chequeDate,
    });
    cheque = await Cheque.create({
      companyId, direction, supplierId, supplierPaymentId: payment._id,
      chequeNumber, bankName, chequeDate, dueDate: dueDate || chequeDate,
      amount, note, userId,
    });
    payment.reference = String(cheque._id);
    await payment.save();
  }

  return cheque;
}

/** Marks a cheque as cleared by the bank — no ledger effect, the payment was already posted as received/paid when the cheque was recorded. */
async function markCleared(chequeId, companyId) {
  const cheque = await Cheque.findOne({ _id: chequeId, companyId });
  if (!cheque) throw new Error('Cheque not found.');
  if (cheque.status === 'bounced') throw new Error('A bounced cheque cannot be marked cleared — record a new cheque instead.');
  cheque.status = 'cleared';
  cheque.clearedAt = new Date();
  await cheque.save();
  return cheque;
}

/**
 * Marks a cheque as bounced/dishonored and reverses the payment it backed
 * — the sale(s)/PO(s) it was allocated against go back to being due, and a
 * compensating voucher undoes the original receipt/payment posting.
 */
async function markBounced(chequeId, companyId, { reason, userId } = {}) {
  const cheque = await Cheque.findOne({ _id: chequeId, companyId });
  if (!cheque) throw new Error('Cheque not found.');
  if (cheque.status === 'bounced') return cheque; // already handled

  if (cheque.direction === 'receivable' && cheque.customerPaymentId) {
    await customerLedgerService.reversePayment(cheque.customerPaymentId, companyId, {
      userId, narration: `Bounced cheque ${cheque.chequeNumber} (${cheque.bankName})`,
    });
  } else if (cheque.direction === 'payable' && cheque.supplierPaymentId) {
    await supplierLedgerService.reversePayment(cheque.supplierPaymentId, companyId, {
      userId, narration: `Bounced cheque ${cheque.chequeNumber} (${cheque.bankName})`,
    });
  }

  cheque.status = 'bounced';
  cheque.bouncedAt = new Date();
  cheque.bounceReason = reason || null;
  await cheque.save();
  return cheque;
}

/** Lists cheques for a company, optionally filtered by status/direction and a due-date window. */
async function list(companyId, filters = {}) {
  const query = { companyId };
  if (filters.status) query.status = filters.status;
  if (filters.direction) query.direction = filters.direction;
  if (filters.from || filters.to) {
    query.dueDate = {};
    if (filters.from) query.dueDate.$gte = new Date(filters.from);
    if (filters.to) query.dueDate.$lte = new Date(filters.to);
  }
  return Cheque.find(query)
    .populate('customerId', 'name phone')
    .populate('supplierId', 'name phone')
    .sort({ dueDate: 1 });
}

/** The genuinely useful "cheques due this week" view — every pending cheque whose dueDate falls within the next 7 days, oldest-due-first, plus anything already overdue. */
async function dueSoon(companyId, days = 7) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return Cheque.find({ companyId, status: 'pending', dueDate: { $lte: end } })
    .populate('customerId', 'name phone')
    .populate('supplierId', 'name phone')
    .sort({ dueDate: 1 });
}

module.exports = { recordChequePayment, markCleared, markBounced, list, dueSoon };
