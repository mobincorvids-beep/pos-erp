const { Schema, model } = require('mongoose');

// What every member of a society is billed per period — a template, not
// an invoice, exactly the shape School's FeeStructure already established
// (and hrService's payroll templates before that): a template read once
// per billing run to stamp out one real invoice per eligible member.
const societyChargeSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // "Monthly Maintenance Fee"
  amount: { type: Number, required: true },
  billingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // trackingMode 'service'
  billingVariantId: { type: Schema.Types.ObjectId, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('SocietyCharge', societyChargeSchema);
