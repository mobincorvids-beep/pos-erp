/**
 * BankStatementService — CSV bank-statement import and auto-matching for
 * bank reconciliation.
 *
 * Expected CSV (header row required, case-insensitive, order doesn't
 * matter):
 *   Date, Description, and either
 *     - a single Amount column (signed: positive = money in, negative = money out), or
 *     - separate Debit/Credit columns (bank-statement convention: Debit =
 *       money OUT, Credit = money IN — the opposite of "debit" in the
 *       double-entry ledger sense used by Voucher/Account).
 *
 * Example (single Amount column):
 *   Date,Description,Amount
 *   2026-08-01,Monthly service fee,-25.00
 *   2026-08-03,Customer payment - INV1042,1500.00
 *
 * Example (Debit/Credit columns):
 *   Date,Description,Debit,Credit,Balance
 *   2026-08-01,Monthly service fee,25.00,,4975.00
 *   2026-08-03,Customer payment - INV1042,,1500.00,6475.00
 *
 * Every parsed line is normalized to a single signed `amount` (positive =
 * deposit, negative = withdrawal). A `Balance` column, if present, is read
 * but not required or used.
 *
 * Matching: a line's signed amount is compared to each unreconciled
 * Voucher entry on the same account, where the entry's book-side movement
 * is (debit - credit) — for an asset-type bank/cash account this is
 * exactly the same "positive = money in" convention as the statement line.
 * A line auto-matches when exactly one entry, within +/-3 days of the
 * line's date and not already used by another line in this reconciliation,
 * has the same amount (within a cent). Zero or multiple candidates leave
 * the line for manual review.
 */
const Voucher = require('../models/Voucher');
const BankReconciliation = require('../models/BankReconciliation');
const { parseCsv } = require('../utils/csvParser');

const DATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // +/- 3 days
const AMOUNT_TOLERANCE = 0.01;

const HEADER_ALIASES = {
  date: ['date', 'txndate', 'transactiondate', 'postingdate', 'valuedate'],
  description: ['description', 'narration', 'memo', 'details', 'particulars', 'reference'],
  amount: ['amount', 'amt'],
  debit: ['debit', 'withdrawal', 'dr'],
  credit: ['credit', 'deposit', 'cr'],
  balance: ['balance', 'runningbalance'],
};

function findColumn(headers, kind) {
  return HEADER_ALIASES[kind].find((alias) => headers.includes(alias)) || null;
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(String(value).replace(/,/g, ''));
  return n;
}

/**
 * Parses raw CSV text into normalized statement lines, sniffing whether the
 * file uses a single signed Amount column or separate Debit/Credit columns.
 * Never throws for a single bad row — bad rows are collected into `errors`
 * (matching the row-tolerant pattern used by the product CSV importer) and
 * the rest of the file still comes back.
 *
 * @returns {{ lines: Array<{date:Date, description:string, amount:number}>, errors: Array<{row:number, error:string}> }}
 */
function parseStatementCsv(text) {
  const { headers, records } = parseCsv(String(text || ''));
  if (headers.length === 0) throw new Error('The CSV file is empty.');

  const dateCol = findColumn(headers, 'date');
  const descCol = findColumn(headers, 'description');
  const amountCol = findColumn(headers, 'amount');
  const debitCol = findColumn(headers, 'debit');
  const creditCol = findColumn(headers, 'credit');

  if (!dateCol) throw new Error(`Missing a Date column. Expected headers like: Date, Description, Amount (or Debit/Credit).`);
  if (!amountCol && !debitCol && !creditCol) {
    throw new Error('Missing an amount column: expected "Amount", or both "Debit" and "Credit".');
  }

  const lines = [];
  const errors = [];

  records.forEach((rec, i) => {
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row
    try {
      const rawDate = rec[dateCol];
      if (!rawDate) throw new Error('date is required.');
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) throw new Error(`could not parse date "${rawDate}".`);

      const description = descCol ? rec[descCol] : '';

      let amount;
      if (amountCol) {
        amount = toNumber(rec[amountCol]);
      } else {
        const debit = toNumber(rec[debitCol]);
        const credit = toNumber(rec[creditCol]);
        amount = credit - debit; // statement convention: credit = money in, debit = money out
      }
      if (!Number.isFinite(amount)) throw new Error('amount is not a valid number.');
      if (amount === 0) throw new Error('amount is zero — nothing to reconcile on this row.');

      lines.push({ date, description: description || '', amount: Math.round(amount * 100) / 100 });
    } catch (err) {
      errors.push({ row: rowNumber, error: err.message });
    }
  });

  return { lines, errors };
}

/** Runs auto-matching over every still-`unmatched` line in `reconciliation` against Voucher entries on its account. Mutates the in-memory subdocuments; caller saves. */
async function autoMatchLines(reconciliation) {
  const pendingLines = reconciliation.statementLines.filter((l) => l.status === 'unmatched');
  if (pendingLines.length === 0) return;

  const times = pendingLines.map((l) => l.date.getTime());
  const rangeStart = new Date(Math.min(...times) - DATE_WINDOW_MS);
  const rangeEnd = new Date(Math.max(...times) + DATE_WINDOW_MS);

  const vouchers = await Voucher.find({
    companyId: reconciliation.companyId,
    date: { $gte: rangeStart, $lte: rangeEnd },
    'entries.accountId': reconciliation.accountId,
  });

  const usedKeys = new Set(
    reconciliation.statementLines
      .filter((l) => l.matchedVoucherId != null && l.matchedEntryIndex != null)
      .map((l) => `${l.matchedVoucherId}:${l.matchedEntryIndex}`)
  );

  const candidates = [];
  vouchers.forEach((v) => {
    v.entries.forEach((e, idx) => {
      if (String(e.accountId) !== String(reconciliation.accountId)) return;
      const key = `${v._id}:${idx}`;
      if (usedKeys.has(key)) return;
      candidates.push({ voucherId: v._id, entryIndex: idx, date: v.date, bookDelta: Math.round((e.debit - e.credit) * 100) / 100, key });
    });
  });

  for (const line of pendingLines) {
    const windowStart = new Date(line.date.getTime() - DATE_WINDOW_MS);
    const windowEnd = new Date(line.date.getTime() + DATE_WINDOW_MS);
    const matches = candidates.filter(
      (c) => !usedKeys.has(c.key) && c.date >= windowStart && c.date <= windowEnd && Math.abs(c.bookDelta - line.amount) < AMOUNT_TOLERANCE
    );
    if (matches.length === 1) {
      const m = matches[0];
      line.status = 'matched';
      line.matchedVoucherId = m.voucherId;
      line.matchedEntryIndex = m.entryIndex;
      line.matchConfidence = 'auto';
      usedKeys.add(m.key);
    }
    // 0 matches: nothing recorded yet (or outside the window) — needs review.
    // >1 matches: ambiguous — needs a human to pick, left unmatched.
  }
}

/** Adds parsed statement lines to a reconciliation and auto-matches them. */
async function importStatementLines(reconciliationId, companyId, lines) {
  const reconciliation = await BankReconciliation.findOne({ _id: reconciliationId, companyId });
  if (!reconciliation) throw new Error('Reconciliation not found.');
  if (reconciliation.status === 'completed') throw new Error('This reconciliation is already completed.');

  reconciliation.statementLines.push(
    ...lines.map((l) => ({ date: new Date(l.date), description: l.description || '', amount: l.amount, status: 'unmatched' }))
  );

  await autoMatchLines(reconciliation);
  await reconciliation.save();
  return reconciliation;
}

/** Manually links one statement line to a specific voucher (the entry on this reconciliation's account is picked automatically; a voucher normally has just one). */
async function confirmLineMatch(reconciliationId, companyId, lineId, voucherId) {
  const reconciliation = await BankReconciliation.findOne({ _id: reconciliationId, companyId });
  if (!reconciliation) throw new Error('Reconciliation not found.');

  const line = reconciliation.statementLines.id(lineId);
  if (!line) throw new Error('Statement line not found.');

  const voucher = await Voucher.findOne({ _id: voucherId, companyId });
  if (!voucher) throw new Error('Voucher not found.');

  const entryIndex = voucher.entries.findIndex((e) => String(e.accountId) === String(reconciliation.accountId));
  if (entryIndex === -1) throw new Error('That voucher has no entry on this reconciliation\'s account.');

  line.status = 'matched';
  line.matchedVoucherId = voucher._id;
  line.matchedEntryIndex = entryIndex;
  line.matchConfidence = 'manual';

  await reconciliation.save();
  return reconciliation;
}

/** Marks a line as having no corresponding recorded transaction — e.g. a bank fee never entered — so the vendor knows to create a new voucher/expense for it. */
async function markLineNoMatch(reconciliationId, companyId, lineId) {
  const reconciliation = await BankReconciliation.findOne({ _id: reconciliationId, companyId });
  if (!reconciliation) throw new Error('Reconciliation not found.');

  const line = reconciliation.statementLines.id(lineId);
  if (!line) throw new Error('Statement line not found.');

  line.status = 'no_match';
  line.matchedVoucherId = null;
  line.matchedEntryIndex = null;
  line.matchConfidence = null;

  await reconciliation.save();
  return reconciliation;
}

/** Reopens a resolved line back to "unmatched" (undo a manual match or no-match call). */
async function resetLine(reconciliationId, companyId, lineId) {
  const reconciliation = await BankReconciliation.findOne({ _id: reconciliationId, companyId });
  if (!reconciliation) throw new Error('Reconciliation not found.');

  const line = reconciliation.statementLines.id(lineId);
  if (!line) throw new Error('Statement line not found.');

  line.status = 'unmatched';
  line.matchedVoucherId = null;
  line.matchedEntryIndex = null;
  line.matchConfidence = null;

  await reconciliation.save();
  return reconciliation;
}

/** The standard reconciliation output: statement total, matched total, unmatched/no-match counts, and the book balance vs statement balance comparison. */
async function reconciliationSummary(reconciliationId, companyId) {
  const bankingService = require('./bankingService'); // required lazily to avoid a require cycle
  const reconciliation = await BankReconciliation.findOne({ _id: reconciliationId, companyId }).populate('statementLines.matchedVoucherId', 'voucherNumber narration');
  if (!reconciliation) throw new Error('Reconciliation not found.');

  const lines = reconciliation.statementLines;
  const statementTotal = Math.round(lines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;
  const matchedTotal = Math.round(lines.filter((l) => l.status === 'matched').reduce((sum, l) => sum + l.amount, 0) * 100) / 100;
  const unmatchedCount = lines.filter((l) => l.status === 'unmatched').length;
  const noMatchCount = lines.filter((l) => l.status === 'no_match').length;

  const bookBalance = await bankingService.computeBookBalance(reconciliation.companyId, reconciliation.accountId, reconciliation.statementDate);

  return {
    reconciliationId: reconciliation._id,
    accountId: reconciliation.accountId,
    statementDate: reconciliation.statementDate,
    statementBalance: reconciliation.statementBalance,
    lineCount: lines.length,
    statementTotal,
    matchedTotal,
    unmatchedCount,
    noMatchCount,
    bookBalance: Math.round(bookBalance * 100) / 100,
    difference: Math.round((bookBalance - reconciliation.statementBalance) * 100) / 100,
    lines: lines.map((l) => ({
      _id: l._id,
      date: l.date,
      description: l.description,
      amount: l.amount,
      status: l.status,
      matchConfidence: l.matchConfidence,
      matchedVoucher: l.matchedVoucherId && typeof l.matchedVoucherId === 'object'
        ? { _id: l.matchedVoucherId._id, voucherNumber: l.matchedVoucherId.voucherNumber, narration: l.matchedVoucherId.narration }
        : (l.matchedVoucherId ? { _id: l.matchedVoucherId } : null),
    })),
  };
}

module.exports = {
  parseStatementCsv, importStatementLines, confirmLineMatch, markLineNoMatch, resetLine, reconciliationSummary,
};
