const { Schema, model } = require('mongoose');

const leaveRequestSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  type: { type: String, default: 'annual', enum: ['annual', 'sick', 'unpaid', 'other'] },
  leavePolicyId: { type: Schema.Types.ObjectId, ref: 'LeavePolicy', default: null },
  reason: String,
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: Date,
}, { timestamps: true });

module.exports = model('LeaveRequest', leaveRequestSchema);
