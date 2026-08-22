const { Schema, model } = require('mongoose');

const templateItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
}, { _id: false });

// A real, universal recurring-billing engine any company can use for any
// customer — genuinely different from every industry-specific recurring
// mechanic already in this app (Telecom's subscription, Real Estate's
// rent, School's fee periods, Housing Society's maintenance): those are
// each tied to a specific business shape. This is the generic core
// version — a monthly retainer, a subscription service, anything a
// company bills the same customer for on a schedule, with no industry
// module required to be active at all.
const recurringInvoiceTemplateSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  items: { type: [templateItemSchema], required: true },
  frequency: { type: String, required: true, enum: ['weekly', 'monthly', 'quarterly', 'annually'] },
  nextRunDate: { type: Date, required: true },
  lastRunDate: { type: Date, default: null },
  status: { type: String, default: 'active', enum: ['active', 'paused', 'cancelled'] },
}, { timestamps: true });

module.exports = model('RecurringInvoiceTemplate', recurringInvoiceTemplateSchema);
