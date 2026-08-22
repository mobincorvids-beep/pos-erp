const { Schema, model } = require('mongoose');

// A unique, non-depleting asset — the genuine new concept this whole
// industry needed, and why it's structurally different from a Product:
// a Property doesn't get "sold down" to zero stock, it cycles between
// available and leased, over and over, across many different tenants
// over its lifetime, each cycle generating its own real income.
const propertySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  unitNumber: { type: String, required: true }, // "Apartment 3B"
  propertyType: { type: String, required: true }, // 'apartment', 'shop', 'office', 'plot'
  status: { type: String, default: 'available', enum: ['available', 'leased'] },
}, { timestamps: true });

module.exports = model('Property', propertySchema);
