/**
 * AccountingService — the only place that writes to the general ledger.
 * Every business event (a sale, an expense, a purchase payment) posts one
 * balanced Voucher here rather than each module inventing its own bookkeeping.
 */
const Voucher = require('../models/Voucher');
const { nextDocumentNumber } = require('./numberingService');
const periodService = require('./periodService');

/**
 * @param {Object} params
 * @param {String} params.companyId
 * @param {String} [params.branchId]
 * @param {'journal'|'payment'|'receipt'|'contra'} params.type
 * @param {Date} [params.date]
 * @param {String} [params.narration]
 * @param {{accountId:String, debit?:Number, credit?:Number}[]} params.entries
 * @param {String} [params.referenceType]
 * @param {String} [params.referenceId]
 * @param {String} [params.userId]
 * @param {import('mongoose').ClientSession} [session]
 */
async function postVoucher(params, session) {
  const {
    companyId, branchId, type, date = new Date(), narration,
    entries, referenceType, referenceId, userId,
  } = params;

  // The real period-lock enforcement — a fast, indexed, read-only check
  // that resolves silently (a genuine no-op) for the overwhelming
  // majority of companies that have never defined an AccountingPeriod at
  // all. Deliberately placed here, before any write happens, so a closed
  // period can never be violated even under concurrent posting attempts.
  await periodService.assertPeriodOpen(companyId, date);

  const [voucher] = await Voucher.create(
    [{
      companyId,
      branchId,
      voucherNumber: nextDocumentNumber('VCH'),
      type,
      date,
      narration,
      referenceType,
      referenceId,
      userId,
      entries,
    }],
    { session }
  );

  return voucher; // schema-level validator enforces debit === credit
}

module.exports = { postVoucher };
