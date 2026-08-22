/**
 * EmployeeLoanService — disburseLoan() posts a real voucher (Dr Employee
 * Loan Receivable, Cr Cash) and creates the loan record. The genuinely
 * new integration is monthlyDeductionFor(): a pure, read-only lookup
 * hrService.generatePayroll() calls to fill in the `advances` field that
 * has existed in PayrollRun's schema this whole project but was always
 * hardcoded to 0 and never actually subtracted from netPay — confirmed
 * by reading generatePayroll's real code before touching it.
 */
const EmployeeLoan = require('../models/EmployeeLoan');
const accountingService = require('./accountingService');

async function disburseLoan(input) {
  const { companyId, branchId, employeeId, principalAmount, monthlyInstallment, loanReceivableAccountId, disbursingAccountId, userId } = input;
  if (!principalAmount || principalAmount <= 0) throw new Error('principalAmount must be greater than zero.');
  if (!monthlyInstallment || monthlyInstallment <= 0) throw new Error('monthlyInstallment must be greater than zero.');

  const existing = await EmployeeLoan.findOne({ employeeId, status: 'active' });
  if (existing) throw new Error('This employee already has an active loan — settle it before issuing a new one.');

  await accountingService.postVoucher({
    companyId, branchId, type: 'payment', narration: `Employee loan disbursed — ${principalAmount}`,
    entries: [
      { accountId: loanReceivableAccountId, debit: principalAmount, credit: 0 },
      { accountId: disbursingAccountId, debit: 0, credit: principalAmount },
    ],
    userId,
  });

  return EmployeeLoan.create({ companyId, employeeId, principalAmount, monthlyInstallment, remainingBalance: principalAmount, loanReceivableAccountId });
}

/** Pure, read-only lookup — the actual deduction for one employee this period: the lesser of the standard installment and whatever's genuinely still owed, so the very last payment never over-collects past a zero balance. */
async function monthlyDeductionFor(employeeId) {
  const loan = await EmployeeLoan.findOne({ employeeId, status: 'active' });
  if (!loan) return 0;
  return Math.min(loan.monthlyInstallment, loan.remainingBalance);
}

/**
 * The real repayment — called explicitly after a payroll run is
 * finalized, not automatically inside generation itself (the same
 * "generate, then a separate explicit step finalizes the real effect"
 * pattern every other draft-then-approve flow in this app already
 * follows). Reduces the real balance and posts one real voucher.
 */
async function recordRepayment(employeeId, amount, { companyId, branchId, salaryPayableAccountId, userId }) {
  if (!amount || amount <= 0) throw new Error('amount must be greater than zero.');
  const loan = await EmployeeLoan.findOne({ employeeId, status: 'active' });
  if (!loan) throw new Error('This employee has no active loan.');
  if (amount > loan.remainingBalance + 0.01) throw new Error(`Repayment of ${amount} exceeds the remaining balance of ${loan.remainingBalance}.`);

  await accountingService.postVoucher({
    companyId, branchId, type: 'journal', narration: `Employee loan repayment via payroll deduction`,
    entries: [
      { accountId: salaryPayableAccountId, debit: amount, credit: 0 },
      { accountId: loan.loanReceivableAccountId, debit: 0, credit: amount },
    ],
    referenceType: 'EmployeeLoan', referenceId: loan._id, userId,
  });

  loan.remainingBalance = Math.round((loan.remainingBalance - amount) * 100) / 100;
  if (loan.remainingBalance <= 0.01) { loan.remainingBalance = 0; loan.status = 'settled'; }
  await loan.save();
  return loan;
}

function listLoans(companyId, { employeeId, status } = {}) {
  const filter = { companyId };
  if (employeeId) filter.employeeId = employeeId;
  if (status) filter.status = status;
  return EmployeeLoan.find(filter).populate('employeeId', 'name').sort({ disbursedAt: -1 });
}

module.exports = { disburseLoan, monthlyDeductionFor, recordRepayment, listLoans };
