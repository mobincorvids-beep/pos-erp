const { Schema, model } = require('mongoose');

const driverSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  licenseNumber: String,
  phone: String,
}, { timestamps: true });

module.exports = model('Driver', driverSchema);
