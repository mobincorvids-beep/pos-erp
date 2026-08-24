const Product = require('../models/Product');
const inventoryService = require('../services/inventoryService');

async function list(req, res) {
  const products = await Product.find({ companyId: req.companyId, isActive: true }).limit(200);
  res.json(products);
}

async function create(req, res) {
  const product = await Product.create({ ...req.body, companyId: req.companyId });
  res.status(201).json(product);
}

/** Was missing entirely — the most-used entity in the whole app had no way to correct a
 * price, a name typo, or reorder levels after creation. Deliberately excludes trackingMode/
 * hasVariants/bundleComponents: those change how stock itself is tracked and can't be
 * flipped after sales/stock movements already exist against the product. */
async function update(req, res) {
  const allowed = [
    'name', 'categoryId', 'unitId', 'sku', 'barcode', 'description',
    'costPrice', 'sellingPrice', 'minStock', 'maxStock', 'reorderLevel',
    'trackExpiry', 'trackSerial',
  ];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];

  const product = await Product.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, updates, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
}

/** Soft-deactivate — every Sale/PurchaseOrder/StockMovement references products by id and
 * must keep resolving. Hides it from POS/catalog listings (list() above already filters
 * isActive: true) without touching any history. */
async function deactivate(req, res) {
  const product = await Product.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, { isActive: false }, { new: true });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json({ ok: true });
}

/** Adds a new variant to an existing variant-tracked product (e.g. a new size/color added
 * to the line later) — was previously only possible at product creation. */
async function addVariant(req, res) {
  const product = await Product.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  product.variants.push(req.body);
  await product.save();
  res.status(201).json(product);
}

/** Edits one variant's sku/barcode/price/weight — was missing, same gap as the product-level
 * update above but for the actual sellable line item. */
async function updateVariant(req, res) {
  const product = await Product.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const variant = product.variants.id(req.params.variantId);
  if (!variant) return res.status(404).json({ error: 'Variant not found.' });

  const allowed = ['sku', 'barcode', 'costPrice', 'sellingPrice', 'weight', 'attributeValues'];
  for (const key of allowed) if (req.body[key] !== undefined) variant[key] = req.body[key];
  await product.save();
  res.json(product);
}

/** Soft-deactivate one variant — same reasoning as deactivate() above, at the variant level:
 * past sales reference this exact variantId and must keep resolving. */
async function deactivateVariant(req, res) {
  const product = await Product.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const variant = product.variants.id(req.params.variantId);
  if (!variant) return res.status(404).json({ error: 'Variant not found.' });

  variant.isActive = false;
  await product.save();
  res.json(product);
}

async function findByBarcode(req, res) {
  const { barcode } = req.params;
  const product = await Product.findOne({ companyId: req.companyId, barcode });
  if (!product) return res.status(404).json({ error: 'Product not found for this barcode.' });
  res.json(product);
}

async function listBatches(req, res) {
  res.json(await inventoryService.listProductBatches(req.companyId, req.query));
}

module.exports = { list, create, update, deactivate, addVariant, updateVariant, deactivateVariant, findByBarcode, listBatches };
