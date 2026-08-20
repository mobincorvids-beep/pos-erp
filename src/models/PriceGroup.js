const { Schema, model } = require('mongoose');

const priceGroupSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // Retail, Wholesale, VIP
}, { timestamps: true });

module.exports = model('PriceGroup', priceGroupSchema);
