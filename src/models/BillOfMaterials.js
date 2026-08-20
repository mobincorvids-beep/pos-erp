const { Schema, model } = require('mongoose');

const componentSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantityPerUnit: { type: Number, required: true }, // raw material needed per ONE finished unit
}, { _id: false });

const billOfMaterialsSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  finishedProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  finishedVariantId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true }, // "Standard Recipe v2", useful once a product has multiple BOMs over time
  components: [componentSchema],
  laborCostPerUnit: { type: Number, default: 0 },
  overheadCostPerUnit: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('BillOfMaterials', billOfMaterialsSchema);
