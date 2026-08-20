const { Schema, model } = require('mongoose');

const productBatchSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true }, // embedded Product.variants._id
  batchNumber: { type: String, required: true },
  manufactureDate: Date,
  expiryDate: Date,
  costPrice: Number,
}, { timestamps: true });

module.exports = model('ProductBatch', productBatchSchema);
