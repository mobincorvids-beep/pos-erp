const { Schema, model } = require('mongoose');

const accountSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  name: { type: String, required: true },
  code: String,
  type: { type: String, required: true }, // asset, liability, equity, income, expense
  isPaymentAccount: { type: Boolean, default: false }, // usable as a POS payment method
  openingBalance: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Account', accountSchema);
