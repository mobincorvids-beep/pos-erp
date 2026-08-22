const { Schema, model } = require('mongoose');

// One member's bill for one period — genuinely reuses Real Estate's real
// Property (a member's plot/house IS a Property, the same non-depleting
// asset concept, not a second, parallel "unit" record), and School's
// exact idempotent-per-period generation pattern: a unique index on
// (chargeId, propertyId, period) makes re-running a billing period a
// silent no-op, never a duplicate charge.
const societyInvoiceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  residentCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  chargeId: { type: Schema.Types.ObjectId, ref: 'SocietyCharge', required: true },
  period: { type: String, required: true }, // "2026-08"
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'paid', 'overdue', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

societyInvoiceSchema.index({ chargeId: 1, propertyId: 1, period: 1 }, { unique: true });

module.exports = model('SocietyInvoice', societyInvoiceSchema);
