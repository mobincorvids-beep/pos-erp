const { Schema, model } = require('mongoose');

const productBatchSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true }, // embedded Product.variants._id
  batchNumber: { type: String, required: true },
  manufactureDate: Date,
  expiryDate: Date,
  costPrice: Number,
  // When this batch was actually received into stock (set by
  // purchaseService.receiveGoods to the GRN's receivedDate at batch
  // creation). Used by inventoryAgingService's aging buckets. Optional —
  // any batch created before this field existed falls back to `createdAt`
  // wherever it's read, which is a reasonable proxy since batches are
  // created at receiving time in the first place.
  receivedDate: { type: Date, default: null },
}, { timestamps: true });

module.exports = model('ProductBatch', productBatchSchema);
