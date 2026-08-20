/**
 * SizeCurveService — turns one target quantity into exact integer
 * quantities per variant, proportional to a saved ratio. The genuinely
 * new mechanic: a naive `Math.round(total * percent / 100)` per entry
 * does NOT reliably sum back to the original total (rounding drift is a
 * real, well-known problem — e.g. 100 split 3 ways at 33.33% each rounds
 * every share to 33, summing to 99, one unit short). This uses the
 * "largest remainder method" — the standard, correct way to do
 * proportional integer apportionment (the same algorithm used for real
 * proportional election seat allocation) — which is guaranteed to sum to
 * EXACTLY the target, not usually-close.
 */
const SizeCurve = require('../models/SizeCurve');
const Product = require('../../../models/Product');

function createCurve(input) {
  const { companyId, name, ratios } = input;
  if (!ratios || ratios.length === 0) throw new Error('At least one size ratio is required.');
  return SizeCurve.create({ companyId, name, ratios });
}

function listCurves(companyId) {
  return SizeCurve.find({ companyId });
}

/**
 * @returns {Promise<Array<{ sizeLabel, variantId, percent, quantity }>>} —
 *   quantities are guaranteed to sum to exactly totalQuantity.
 */
async function applyCurve(curveId, productId, totalQuantity) {
  if (!totalQuantity || totalQuantity <= 0 || !Number.isInteger(totalQuantity)) {
    throw new Error('totalQuantity must be a positive whole number — you can\'t order a fractional pair of shoes.');
  }

  const curve = await SizeCurve.findById(curveId);
  if (!curve) throw new Error('Size curve not found.');

  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found.');

  // Step 1: exact (fractional) share and its floor for every size.
  const shares = curve.ratios.map((r) => {
    const variant = product.variants.find((v) => v.attributeValues?.get('Size') === r.sizeLabel);
    if (!variant) throw new Error(`No variant with Size "${r.sizeLabel}" exists on this product.`);

    const exact = (totalQuantity * r.percent) / 100;
    return { sizeLabel: r.sizeLabel, variantId: variant._id, percent: r.percent, exact, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });

  // Step 2: how many whole units are still unassigned after flooring every share?
  const flooredSum = shares.reduce((sum, s) => sum + s.floor, 0);
  let remaining = totalQuantity - flooredSum;

  // Step 3: hand out the leftover units one each to the LARGEST remainders
  // first — the entries that were rounded down the most unfairly get
  // bumped up first. This is what guarantees the final sum is exact.
  const byRemainderDesc = [...shares].sort((a, b) => b.remainder - a.remainder);
  for (const s of byRemainderDesc) {
    if (remaining <= 0) break;
    s.floor += 1;
    remaining -= 1;
  }

  const result = shares.map((s) => ({ sizeLabel: s.sizeLabel, variantId: s.variantId, percent: s.percent, quantity: s.floor }));
  const total = result.reduce((sum, r) => sum + r.quantity, 0);
  if (total !== totalQuantity) throw new Error(`Internal apportionment error: quantities summed to ${total}, expected ${totalQuantity}.`); // should be mathematically impossible — a real invariant check, not defensive filler

  return result;
}

module.exports = { createCurve, listCurves, applyCurve };
