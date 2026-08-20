const { Schema, model } = require('mongoose');

const doctorSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  registrationNumber: String, // PMDC number etc.
  specialization: String,
  phone: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Doctor', doctorSchema);
