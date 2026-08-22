const { Schema, model } = require('mongoose');

// A real loan given TO an employee (an advance, an emergency loan) — an
// asset to the company (the employee owes it back), repaid via real
// payroll deduction each month. Genuinely different from every other
// "loan"-shaped thing in this app (Fixed Assets, AP/AR) because the
// repayment source is specifically the employee's own payslip, not a
// separate payment transaction.
const employeeLoanSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  principalAmount: { type: Number, required: true },
  monthlyInstallment: { type: Number, required: true },
  remainingBalance: { type: Number, required: true },
  loanReceivableAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  status: { type: String, default: 'active', enum: ['active', 'settled'] },
  disbursedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('EmployeeLoan', employeeLoanSchema);
