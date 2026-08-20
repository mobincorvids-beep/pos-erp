const { Schema, model } = require('mongoose');

// One student's bill for one period. Kept separate from a core Sale until
// paid — the invoice exists (and can be tracked as overdue) whether or not
// it's ever collected; only paying it creates a real Sale, through the
// ordinary checkout, same as every other module's billing step.
const feeInvoiceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  feeStructureId: { type: Schema.Types.ObjectId, ref: 'FeeStructure', required: true },
  period: { type: String, required: true }, // "2026-08" for monthly, or a term/year label
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'paid', 'overdue', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

feeInvoiceSchema.index({ feeStructureId: 1, studentId: 1, period: 1 }, { unique: true }); // one invoice per student per structure per period — regenerating a period is a no-op, not a duplicate

module.exports = model('FeeInvoice', feeInvoiceSchema);
