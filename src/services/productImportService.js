/**
 * ProductImportService — bulk CSV import of products (and, when a row carries
 * openingStock, an opening-stock movement for it). One bad row never fails
 * the whole batch: every row is validated independently and collected into a
 * { created, updated, failed, errors } summary.
 *
 * Expected columns (header row required, case-insensitive, order doesn't
 * matter): name, sku, barcode, category, subcategory, unit, costPrice,
 * sellingPrice, openingStock, minStock, reorderLevel.
 */
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Unit = require('../models/Unit');
const Warehouse = require('../models/Warehouse');
const categoryService = require('./categoryService');
const inventoryService = require('./inventoryService');

const REQUIRED_COLUMNS = ['name'];
const KNOWN_COLUMNS = [
  'name', 'sku', 'barcode', 'category', 'subcategory', 'unit',
  'costprice', 'sellingprice', 'openingstock', 'minstock', 'reorderlevel',
];

/** Minimal RFC4180-ish CSV parser — handles quoted fields, escaped quotes ("") and commas/newlines inside quotes. Good enough for a spreadsheet export without pulling in a dependency. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // Normalize line endings and strip a UTF-8 BOM if Excel added one.
  const input = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  // Flush the last field/row (files not ending in a trailing newline).
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  if (nonEmpty.length === 0) return { headers: [], records: [] };

  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  const records = nonEmpty.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
  return { headers, records };
}

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * @param {String} companyId
 * @param {String} userId
 * @param {Buffer|String} fileContent - raw uploaded CSV
 * @returns {Promise<{created:Number, updated:Number, failed:Number, errors:Array<{row:Number, error:String}>}>}
 */
async function importProductsCsv(companyId, userId, fileContent) {
  const text = Buffer.isBuffer(fileContent) ? fileContent.toString('utf8') : String(fileContent);
  const { headers, records } = parseCsv(text);

  if (headers.length === 0) throw new Error('The CSV file is empty.');
  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) throw new Error(`Missing required column "${col}". Expected headers: ${KNOWN_COLUMNS.join(', ')}.`);
  }

  const warehouse = await Warehouse.findOne({ companyId, isDefault: true }) || await Warehouse.findOne({ companyId, isActive: true });

  const summary = { created: 0, updated: 0, failed: 0, errors: [] };
  const unitCache = new Map(); // lowercased name -> Unit doc

  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row
    const rec = records[i];
    try {
      if (!rec.name) throw new Error('name is required.');

      const costPrice = toNumber(rec.costprice, 0);
      const sellingPrice = toNumber(rec.sellingprice, 0);
      const openingStock = toNumber(rec.openingstock, 0);
      const minStock = toNumber(rec.minstock, 0);
      const reorderLevel = toNumber(rec.reorderlevel, 0);
      if ([costPrice, sellingPrice, openingStock, minStock, reorderLevel].some((n) => Number.isNaN(n))) {
        throw new Error('costPrice, sellingPrice, openingStock, minStock, and reorderLevel must be numbers.');
      }

      // Find-or-create category/subcategory by name, scoped to this company —
      // case-insensitive, same rule as categoryService.findOrCreateByName.
      let categoryId = null;
      if (rec.category) {
        const category = await categoryService.findOrCreateByName(companyId, rec.category, null);
        categoryId = category._id;
        if (rec.subcategory) {
          const subcategory = await categoryService.findOrCreateByName(companyId, rec.subcategory, categoryId);
          categoryId = subcategory._id;
        }
      } else {
        const uncategorized = await categoryService.getOrCreateUncategorized(companyId);
        categoryId = uncategorized._id;
      }

      let unitId;
      if (rec.unit) {
        const key = rec.unit.toLowerCase();
        if (unitCache.has(key)) {
          unitId = unitCache.get(key)._id;
        } else {
          let unit = await Unit.findOne({ companyId, name: new RegExp(`^${rec.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
          if (!unit) unit = await Unit.create({ companyId, name: rec.unit, shortCode: rec.unit.slice(0, 4) });
          unitCache.set(key, unit);
          unitId = unit._id;
        }
      }

      // Upsert by SKU, then barcode, scoped to this company — a re-import of
      // the same file (or a "top up stock" file) updates rather than duplicates.
      let product = null;
      if (rec.sku) product = await Product.findOne({ companyId, sku: rec.sku });
      if (!product && rec.barcode) product = await Product.findOne({ companyId, barcode: rec.barcode });

      const isNew = !product;
      if (!product) {
        product = new Product({
          companyId, name: rec.name, sku: rec.sku || undefined, barcode: rec.barcode || undefined,
          categoryId, unitId, costPrice, sellingPrice, minStock, reorderLevel,
          trackingMode: 'simple',
          variants: [{ sku: rec.sku || undefined, barcode: rec.barcode || undefined, costPrice, sellingPrice }],
        });
      } else {
        product.name = rec.name;
        if (rec.barcode) product.barcode = rec.barcode;
        product.categoryId = categoryId;
        if (unitId) product.unitId = unitId;
        product.costPrice = costPrice;
        product.sellingPrice = sellingPrice;
        product.minStock = minStock;
        product.reorderLevel = reorderLevel;
        if (product.variants?.[0]) {
          product.variants[0].costPrice = costPrice;
          product.variants[0].sellingPrice = sellingPrice;
          if (rec.barcode) product.variants[0].barcode = rec.barcode;
        }
      }
      await product.save();

      // Opening stock — posted through the exact same inventoryService path
      // every other stock-in flow in this app uses (purchase receiving,
      // stocktake adjustments), so the ledger/StockLevel cache stay consistent.
      if (openingStock > 0) {
        if (!warehouse) {
          throw new Error('openingStock given but no warehouse is configured for this company — set up a warehouse first.');
        }
        const variant = product.variants?.[0];
        await inventoryService.recordMovement({
          companyId, warehouseId: warehouse._id, productId: product._id, variantId: variant?._id,
          type: 'adjustment', quantity: openingStock, unitCost: costPrice,
          referenceType: 'ProductImport', referenceId: product._id, userId,
          note: `Opening stock from CSV import (row ${rowNumber}).`,
        });
      }

      if (isNew) summary.created++; else summary.updated++;
    } catch (err) {
      summary.failed++;
      summary.errors.push({ row: rowNumber, error: err.message });
    }
  }

  return summary;
}

module.exports = { importProductsCsv, parseCsv, KNOWN_COLUMNS };
