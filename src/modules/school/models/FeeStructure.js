const { Schema, model } = require('mongoose');

// What a class is billed, per period — a template, not an invoice.
// generateFeeInvoices() reads this and stamps out one FeeInvoice per
// eligible student for a given period, the same "template -> batch of
// per-entity documents for one period" shape hrService.generatePayroll
// already uses for payroll, applied here to receivables instead of payables.
const feeStructureSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // "Grade 5 Monthly Tuition"
  className: String, // null/empty = applies to every active student regardless of class
  amount: { type: Number, required: true },
  billingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // must be trackingMode 'service' — a fee isn't stock
  billingVariantId: { type: Schema.Types.ObjectId, required: true },
  frequency: { type: String, default: 'monthly', enum: ['monthly', 'termly', 'annual'] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('FeeStructure', feeStructureSchema);
