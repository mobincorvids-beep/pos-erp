/**
 * BadDebtService — arAgingReport() is a genuinely new report: nothing in
 * core Reporting bucketed outstanding receivables by how overdue they
 * are, confirmed by listing every real report function before building
 * this. Since Sale has no explicit due-date field, aging is measured
 * from createdAt — a defensible default for credit terms that aren't
 * otherwise tracked, stated here rather than left implicit.
 *
 * writeOffReceivable() is the real accounting action that follows from
 * that report: a genuinely uncollectible receivable gets removed from
 * the books via a real voucher (Dr Bad Debt Expense, Cr Accounts
 * Receivable), and the sale's dueAmount permanently drops to zero — it
 * disappears from AR aging going forward, which is the entire point.
 */
const Sale = require('../models/Sale');
const accountingService = require('./accountingService');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function bucketFor(daysOverdue) {
  if (daysOverdue <= 30) return '0-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

async function arAgingReport(companyId, asOfDate = new Date()) {
  // Only sales that have actually been invoiced are real receivables — a
  // 'quotation' or 'sales_order' status sale can carry a non-zero
  // dueAmount before it's ever been billed, which used to leak into this
  // report as a row with a blank invoice number (invoiceNumber is only
  // assigned once a quotation is actually converted/invoiced — see
  // Sale.js). Restricting to invoiced statuses keeps AR aging to genuine
  // outstanding invoices only.
  const outstandingSales = await Sale.find({ companyId, dueAmount: { $gt: 0 }, writtenOff: false, status: { $nin: ['cancelled', 'quotation', 'sales_order'] } })
    .populate('customerId', 'name').sort({ createdAt: 1 });

  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const rows = outstandingSales.map((sale) => {
    const daysOverdue = Math.max(0, Math.floor((asOfDate - sale.createdAt) / MS_PER_DAY));
    const bucket = bucketFor(daysOverdue);
    buckets[bucket] = Math.round((buckets[bucket] + sale.dueAmount) * 100) / 100;
    return { saleId: sale._id, invoiceNumber: sale.invoiceNumber, customerName: sale.customerId?.name || 'Walk-in', daysOverdue, bucket, dueAmount: sale.dueAmount };
  });

  return { asOfDate, rows, buckets, totalOutstanding: Math.round(Object.values(buckets).reduce((s, v) => s + v, 0) * 100) / 100 };
}

/** The real write-off — a permanent, real accounting action, not a soft delete. Once written off, this sale's dueAmount is permanently 0 and it disappears from AR aging going forward. */
async function writeOffReceivable(saleId, { badDebtExpenseAccountId, receivableAccountId, userId }) {
  const sale = await Sale.findById(saleId);
  if (!sale) throw new Error('Sale not found.');
  if (sale.writtenOff) throw new Error('This receivable has already been written off.');
  if (sale.dueAmount <= 0) throw new Error('This sale has no outstanding balance to write off.');

  const amount = sale.dueAmount;
  const voucher = await accountingService.postVoucher({
    companyId: sale.companyId, branchId: sale.branchId, type: 'journal', narration: `Bad debt write-off — invoice ${sale.invoiceNumber}`,
    entries: [
      { accountId: badDebtExpenseAccountId, debit: amount, credit: 0 },
      { accountId: receivableAccountId, debit: 0, credit: amount },
    ],
    referenceType: 'Sale', referenceId: sale._id, userId,
  });

  sale.dueAmount = 0;
  sale.writtenOff = true;
  sale.writtenOffAt = new Date();
  await sale.save();

  return { sale, voucher, amountWrittenOff: amount };
}

module.exports = { arAgingReport, writeOffReceivable };
