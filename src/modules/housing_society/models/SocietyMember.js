const { Schema, model } = require('mongoose');

// Links a real Property (a plot/house, from Real Estate) to whichever
// resident is currently the billable occupant — the roster
// generateSocietyInvoices() reads every billing run.
const societyMemberSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, unique: true },
  residentCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
}, { timestamps: true });

module.exports = model('SocietyMember', societyMemberSchema);
