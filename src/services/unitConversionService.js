/**
 * UnitConversionService — the actual missing piece behind multi-UOM.
 * `Unit.conversionFactor` and `Unit.baseUnitId` have existed in the
 * schema this whole project, but were never read or used anywhere —
 * confirmed by grepping the entire codebase before writing this file.
 * The schema alone was never really "multi-UOM support"; this is the
 * real conversion logic that was missing.
 *
 * Deliberately a thin layer in FRONT of the existing, heavily-tested
 * core functions (inventoryService.recordMovement, posSaleService.checkout)
 * — it converts a quantity expressed in some alternate unit into the
 * product's real BASE tracking unit, and callers pass that converted
 * quantity into the unmodified core functions themselves. This file
 * never touches recordMovement or checkout — the single riskiest thing
 * to do with the most heavily-exercised code in this entire project
 * would be modifying it for a feature that can be layered on top instead.
 */
const Unit = require('../models/Unit');

/** Resolves a unit's quantity into its base-unit-equivalent quantity. A unit with no baseUnitId IS a base unit, its own quantity, unconverted. */
function toBaseQuantity(unit, quantity) {
  return unit.baseUnitId ? Math.round(quantity * unit.conversionFactor * 1e6) / 1e6 : quantity;
}

/**
 * Converts a quantity from one unit to another. Both units must share
 * the SAME base unit (or one of them must actually BE that base unit) —
 * converting between two genuinely unrelated units (e.g. a company's
 * "Kg" and a different company's unrelated "Box") is rejected rather
 * than silently producing a nonsensical number.
 */
async function convertQuantity(fromUnitId, toUnitId, quantity) {
  if (String(fromUnitId) === String(toUnitId)) return quantity; // no conversion needed — the common case

  const [fromUnit, toUnit] = await Promise.all([Unit.findById(fromUnitId), Unit.findById(toUnitId)]);
  if (!fromUnit) throw new Error('Source unit not found.');
  if (!toUnit) throw new Error('Target unit not found.');

  const fromBaseId = fromUnit.baseUnitId ? String(fromUnit.baseUnitId) : String(fromUnit._id);
  const toBaseId = toUnit.baseUnitId ? String(toUnit.baseUnitId) : String(toUnit._id);
  if (fromBaseId !== toBaseId) throw new Error(`"${fromUnit.name}" and "${toUnit.name}" don't share a common base unit, they can't be converted between each other.`);

  const baseQty = toBaseQuantity(fromUnit, quantity);
  const converted = toUnit.baseUnitId ? baseQty / toUnit.conversionFactor : baseQty;
  return Math.round(converted * 1e6) / 1e6;
}

/** Converts a quantity FROM some alternate unit INTO a product's own real tracking unit: the actual call site every purchase/sale flow needs before handing a quantity to recordMovement/checkout. */
async function convertToProductUnit(product, fromUnitId, quantity) {
  if (!product.unitId) return quantity; // product has no tracking unit configured — nothing to convert against, pass through unchanged
  return convertQuantity(fromUnitId, product.unitId, quantity);
}

/** Converts a per-unit COST from one unit to another, the necessary companion to convertQuantity(). If 1 fromUnit = K toUnits, the real cost per toUnit is fromUnitCost / K, preserving the true total cost regardless of which unit it's expressed in (2 cartons × 500 must equal 576 pieces × the converted per-piece cost). */
async function convertUnitCost(fromUnitId, toUnitId, unitCost) {
  if (String(fromUnitId) === String(toUnitId)) return unitCost;
  const conversionRatio = await convertQuantity(fromUnitId, toUnitId, 1); // how many toUnits equal exactly 1 fromUnit
  return Math.round((unitCost / conversionRatio) * 1e6) / 1e6;
}

/**
 * The real call site for purchasing in an alternate unit: converts every
 * line item's quantity AND unit cost into the product's own tracking
 * unit, so the resulting items are ready to hand directly to
 * purchaseService.createPurchaseOrder completely unmodified — this
 * function does the unit-aware work, core Purchasing never has to know
 * multi-UOM exists at all.
 */
async function convertPurchaseItemsToProductUnits(items) {
  const Product = require('../models/Product');
  const converted = [];
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found.`);
    const purchaseUnitId = item.purchaseUnitId || product.unitId;
    const quantityOrdered = await convertToProductUnit(product, purchaseUnitId, item.quantity);
    const unitCost = product.unitId ? await convertUnitCost(purchaseUnitId, product.unitId, item.unitCost) : item.unitCost;
    converted.push({ productId: item.productId, variantId: item.variantId, quantityOrdered, unitCost });
  }
  return converted;
}

module.exports = { convertQuantity, convertToProductUnit, convertUnitCost, convertPurchaseItemsToProductUnits, toBaseQuantity };
