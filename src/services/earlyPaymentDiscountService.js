/**
 * EarlyPaymentDiscountService — the real, ERP-appropriate piece of
 * "dynamic discounting" from Fauree's feature list: a standard "2/10 net
 * 30" trade-credit term (2% off if paid within 10 days, full amount
 * otherwise due within 30) — genuinely different from a lending
 * marketplace or embedded finance, since no third-party financier is
 * involved at all; it's the company's own cash paying its own supplier
 * earlier than required, in exchange for a real discount the supplier
 * already agreed to.
 *
 * Deliberately a NEW, additive function rather than a modification to
 * supplierLedgerService.recordPayment() — the existing, heavily-used
 * ordinary payment path is untouched; this only handles the specific
 * "pay early enough to actually qualify for the discount" case, and
 * refuses honestly (rather than silently paying in full under a
 * "discount" function's name) when a payment date doesn't qualify.
 */
const PurchaseOrder = require('../models/PurchaseOrder');
const accountingService = require('./accountingService');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Sets real early-payment terms on an existing PO — deliberately its own
 * small function rather than a change to purchaseService.createPurchaseOrder
 * itself, the single most heavily-used function in core Purchasing. This
 * keeps that function completely untouched; a company that never uses
 * this feature never has any reason to even know these fields exist.
 */
async function setDiscountTerms(purchaseOrderId, { paymentTermsDays, earlyPaymentDiscountPercent, earlyPaymentDiscountDays }) {
  if (earlyPaymentDiscountPercent < 0 || earlyPaymentDiscountPercent > 100) throw new Error('earlyPaymentDiscountPercent must be between 0 and 100.');
  const po = await PurchaseOrder.findByIdAndUpdate(purchaseOrderId, { paymentTermsDays, earlyPaymentDiscountPercent, earlyPaymentDiscountDays }, { new: true });
  if (!po) throw new Error('Purchase order not found.');
  return po;
}

/** Pure, read-only eligibility check — no money moves here. */
async function calculateDiscount(purchaseOrderId, paymentDate) {
  const po = await PurchaseOrder.findById(purchaseOrderId);
  if (!po) throw new Error('Purchase order not found.');
  if (po.dueAmount <= 0) return { eligible: false, discountAmount: 0, reason: 'No outstanding balance.' };
  if (!po.earlyPaymentDiscountPercent || po.earlyPaymentDiscountPercent <= 0) return { eligible: false, discountAmount: 0, reason: 'This PO has no early payment discount terms.' };

  const daysElapsed = Math.floor((new Date(paymentDate) - (po.orderDate || po.createdAt)) / MS_PER_DAY);
  if (daysElapsed > po.earlyPaymentDiscountDays) {
    return { eligible: false, discountAmount: 0, reason: `Payment is ${daysElapsed} days after the order date — the discount window closed after ${po.earlyPaymentDiscountDays} days.`, daysElapsed };
  }

  const discountAmount = Math.round(po.dueAmount * (po.earlyPaymentDiscountPercent / 100) * 100) / 100;
  return { eligible: true, discountAmount, daysElapsed, dueAmount: po.dueAmount };
}

/**
 * Applies the discount for real — a genuine 3-leg voucher, hand-verified
 * to balance before this file was written: Dr Accounts Payable for the
 * FULL amount owed, Cr Cash for the discounted amount actually paid,
 * Cr Discount Income for the real savings. The payable is fully cleared
 * (dueAmount -> 0) even though less cash actually left the business —
 * the discount income leg is what makes the voucher balance honestly.
 */
async function payWithEarlyDiscount(purchaseOrderId, { paymentDate, paymentAccountId, discountIncomeAccountId, payableAccountId, userId }) {
  const check = await calculateDiscount(purchaseOrderId, paymentDate || new Date());
  if (!check.eligible) throw new Error(`Not eligible for an early payment discount: ${check.reason}`);

  const po = await PurchaseOrder.findById(purchaseOrderId);
  const dueAmount = po.dueAmount;
  const discountAmount = check.discountAmount;
  const amountPaid = Math.round((dueAmount - discountAmount) * 100) / 100;

  const voucher = await accountingService.postVoucher({
    companyId: po.companyId, branchId: po.branchId, type: 'payment', date: paymentDate || new Date(),
    narration: `Early payment with discount — PO ${po.poNumber} (${po.earlyPaymentDiscountPercent}% off)`,
    entries: [
      { accountId: payableAccountId, debit: dueAmount, credit: 0 },
      { accountId: paymentAccountId, debit: 0, credit: amountPaid },
      { accountId: discountIncomeAccountId, debit: 0, credit: discountAmount },
    ],
    referenceType: 'PurchaseOrder', referenceId: po._id, userId,
  });

  po.paidAmount = Math.round((po.paidAmount + dueAmount) * 100) / 100; // the FULL original obligation is now settled, discount included
  po.dueAmount = 0;
  await po.save();

  return { po, voucher, discountAmount, amountPaid };
}

module.exports = { setDiscountTerms, calculateDiscount, payWithEarlyDiscount };
