const { Schema, model } = require('mongoose');

// Deliberately its own record, not a core Customer — a student has
// guardians, a class, an enrollment date; a Customer has a credit limit
// and a sales ledger. A school could still link a Student to a Customer
// (for a family paying multiple children's fees under one account), but
// nothing in this module requires it, so that's left optional and unused
// for now rather than forced.
const studentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null }, // optional link if the guardian also has a billing account
  name: { type: String, required: true },
  className: String, // "Grade 5", "O-Level"...
  guardianName: String,
  guardianPhone: String,
  enrollmentDate: { type: Date, default: Date.now },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
}, { timestamps: true });

module.exports = model('Student', studentSchema);
