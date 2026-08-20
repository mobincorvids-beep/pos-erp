const { Schema, model } = require('mongoose');

const branchSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  code: String, // e.g. LHR-01
  address: String,
  phone: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

branchSchema.index({ companyId: 1, code: 1 }, { unique: true, sparse: true });

module.exports = model('Branch', branchSchema);
