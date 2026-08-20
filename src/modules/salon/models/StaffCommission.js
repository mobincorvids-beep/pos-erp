const { Schema, model } = require('mongoose');

// A commission owed to a staff member for performing a service — this is
// the interlink point with HRMS & Payroll: hrService.generatePayroll()
// looks up unpaid commissions for the pay period and folds them into that
// employee's net pay, then marks them 'paid' once the payroll run posts.
const staffCommissionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  salonServiceId: { type: Schema.Types.ObjectId, ref: 'SalonService', required: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'unpaid', enum: ['unpaid', 'paid'] },
  payrollRunId: { type: Schema.Types.ObjectId, ref: 'PayrollRun', default: null }, // set when folded into a payroll run
  earnedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('StaffCommission', staffCommissionSchema);
