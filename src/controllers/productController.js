const Product = require('../models/Product');
const inventoryService = require('../services/inventoryService');
const serialInventoryService = require('../services/serialInventoryService');
const productImportService = require('../services/productImportService');

async function list(req, res) {
  const products = await Product.find({ companyId: req.companyId, isActive: true }).limit(200);
  res.json(products);
}

/** categoryId is required going forward, every NEW product must be filed under a
 * category (and optionally a subcategory). Products created before this requirement
 * existed keep whatever they have (including none) — see categoryService's
 * "Uncategorized" fallback, used by the CSV importer and available for manual cleanup. */
/** Images arrive as an array of base64 data-URI strings (already resized/compressed
 * client-side). Reject obviously-oversized payloads before they ever reach Mongoose/
 * Mongo, on top of the schema-level validator in Product.js. */
function validateImages(images) {
  if (images === undefined) return null;
  if (!Array.isArray(images)) return 'images must be an array of strings.';
  if (images.length > 4) return 'A product may have at most 4 images.';
  for (const img of images) {
    if (typeof img !== 'string') return 'Each image must be a string (data URI).';
    if (img.length > 1_500_000) return 'Each image must be under ~1.5MB (base64-encoded).';
  }
  return null;
}

async function create(req, res) {
  try {
    if (!req.body.categoryId) {
      return res.status(400).json({ error: 'categoryId is required, choose a category (and optionally a subcategory) for this product.' });
    }
    const imagesError = validateImages(req.body.images);
    if (imagesError) return res.status(400).json({ error: imagesError });
    const product = await Product.create({ ...req.body, companyId: req.companyId });
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}


/** Was missing entirely, the most-used entity in the whole app had no way to correct a
 * price, a name typo, or reorder levels after creation. Deliberately excludes trackingMode/
 * hasVariants/bundleComponents: those change how stock itself is tracked and can't be
 * flipped after sales/stock movements already exist against the product. */
async function update(req, res) {
  const allowed = [
    'name', 'categoryId', 'unitId', 'sku', 'barcode', 'description', 'images',
    'costPrice', 'sellingPrice', 'minStock', 'maxStock', 'reorderLevel',
    'trackExpiry', 'trackSerial',
  ];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];

  const imagesError = validateImages(updates.images);
  if (imagesError) return res.status(400).json({ error: imagesError });

  const product = await Product.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, updates, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
}

/** Soft-deactivate: every Sale/PurchaseOrder/StockMovement references products by id and
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

/** Edits one variant's sku/barcode/price/weight: was missing, same gap as the product-level
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

/** Soft-deactivate one variant: same reasoning as deactivate() above, at the variant level:
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

/** GET /products/available-batches?variantId=&warehouseId= — FEFO-sorted batches with sellable stock, for the POS checkout batch/lot picker. */
async function listAvailableBatches(req, res) {
  const { variantId, warehouseId } = req.query;
  if (!variantId || !warehouseId) return res.status(400).json({ error: 'variantId and warehouseId are both required.' });
  res.json(await inventoryService.listAvailableBatches(warehouseId, variantId));
}

/** GET /products/available-serials?variantId=&warehouseId= — in-stock serial numbers, for the POS checkout serial picker. */
async function listAvailableSerials(req, res) {
  const { variantId, warehouseId } = req.query;
  if (!variantId || !warehouseId) return res.status(400).json({ error: 'variantId and warehouseId are both required.' });
  res.json(await serialInventoryService.listAvailable(variantId, warehouseId));
}

/** POST /products/import-csv: bulk create/update products (and post opening stock) from an uploaded CSV. Never fails the whole batch on one bad row; see productImportService for the row-by-row contract. */
async function importCsv(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No CSV file was uploaded (expected multipart field "file").' });
  try {
    const summary = await productImportService.importProductsCsv(req.companyId, req.auth?.userId, req.file.buffer);
    res.json(summary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  list, create, update, deactivate, addVariant, updateVariant, deactivateVariant, findByBarcode,
  listBatches, listAvailableBatches, listAvailableSerials, importCsv,
};
