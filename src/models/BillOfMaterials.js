const { Schema, model } = require('mongoose');

const componentSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantityPerUnit: { type: Number, required: true }, // raw material needed per ONE finished unit
}, { _id: false });

// A secondary output a production run also yields alongside the main
// finished good — e.g. sawdust from milling lumber, offcuts from cutting
// fabric, whey from making cheese. Expressed the same "per ONE finished
// unit" way as componentSchema so completeProduction() can scale it by
// quantityProduced exactly like it already scales material consumption.
const byproductSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantityPerUnit: { type: Number, required: true }, // byproduct quantity yielded per ONE finished (main output) unit
}, { _id: false });

const billOfMaterialsSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  finishedProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  finishedVariantId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true }, // "Standard Recipe v2", useful once a product has multiple BOMs over time
  components: [componentSchema],
  // Optional secondary/co-product outputs. Empty by default so every BOM
  // created before this field existed behaves exactly as before (no
  // byproduct stock posted at completion).
  byproducts: { type: [byproductSchema], default: [] },
  laborCostPerUnit: { type: Number, default: 0 },
  overheadCostPerUnit: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('BillOfMaterials', billOfMaterialsSchema);
