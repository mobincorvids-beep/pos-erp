const { Schema, model } = require('mongoose');

const supplierSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  phone: String,
  email: String,
  address: String,
  openingBalance: { type: Number, default: 0 }, // +ve = company owes supplier
}, { timestamps: true });

module.exports = model('Supplier', supplierSchema);
