const { Schema, model } = require('mongoose');

const leadSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  contactName: { type: String },
  phone: String,
  email: String,
  source: { type: String, enum: ['website', 'referral', 'walk-in', 'social', 'other'], default: 'other' },
  status: { type: String, enum: ['new', 'contacted', 'qualified', 'unqualified', 'converted'], default: 'new' },
  assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' },
  // Set once convertLeadToCustomer() runs — links this lead forward to the
  // real Customer it became, the same way Sale.convertedFromId links a
  // sales order back to the quotation it came from.
  convertedCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
}, { timestamps: true });

leadSchema.index({ companyId: 1, status: 1 });

module.exports = model('Lead', leadSchema);
