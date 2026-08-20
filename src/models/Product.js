const { Schema, model } = require('mongoose');

const variantSchema = new Schema({
  sku: String,
  barcode: String,
  attributeValues: { type: Map, of: String }, // { Size: 'M', Color: 'Red' }
  costPrice: Number,      // overrides product default when set
  sellingPrice: Number,   // overrides product default when set
  weight: Number,         // grams, for weight-based items (jewelry etc.)
  isActive: { type: Boolean, default: true },
}, { _id: true, timestamps: true });

const bundleComponentSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true }, // how many of this component per one bundle sold
}, { _id: false });

const productSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
  unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
  name: { type: String, required: true },
  sku: String,
  barcode: { type: String, index: true },
  description: String,

  // simple | variant | batch | serial | weight | recipe | bundle
  trackingMode: { type: String, default: 'simple' },

  costPrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 },
  maxStock: Number,
  reorderLevel: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  hasVariants: { type: Boolean, default: false },
  trackExpiry: { type: Boolean, default: false },
  trackSerial: { type: Boolean, default: false },
  isWeightBased: { type: Boolean, default: false },

  // Set when trackingMode === 'bundle'. The bundle itself is never stocked —
  // selling it deducts each component's stock instead (see
  // inventoryService.expandBundleItems, called from checkout). This is how
  // "Bundles / Deals" and "Combos" from the proposal are implemented: no
  // separate Bundle collection, just a Product that resolves to other Products.
  bundleComponents: [bundleComponentSchema],

  // Embedded variants — for products with no real variation, one implicit
  // variant is created automatically (see ProductService.createSimpleVariant).
  variants: [variantSchema],
}, { timestamps: true });

productSchema.index({ companyId: 1, sku: 1 });

module.exports = model('Product', productSchema);
