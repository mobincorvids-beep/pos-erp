const { Schema, model } = require('mongoose');

// A recruitment vacancy — the thing candidates apply against. Kept
// separate from Employee/Department: a JobOpening may exist (and close)
// without ever producing an Employee, and a company may run several
// openings against the same department at once.
const jobOpeningSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  title: { type: String, required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null }, // Department model exists — reference it rather than free text
  description: { type: String, default: '' },
  status: { type: String, default: 'open', enum: ['open', 'on_hold', 'closed'] },
  numberOfPositions: { type: Number, default: 1 },
  postedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

jobOpeningSchema.index({ companyId: 1, status: 1 });

module.exports = model('JobOpening', jobOpeningSchema);
