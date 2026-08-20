/**
 * MarkdownService — automatic time-decay pricing. The genuinely new axis:
 * every other pricing mechanic in this app is triggered by something a
 * customer or staff member DOES (buy more units for Distribution's tiers,
 * an external gold-rate change for Jewelry) — this one changes on its own
 * purely because time passed, with zero action from anyone. A product
 * launched 45 days ago is automatically cheaper today than it was
 * yesterday if a stage threshold was crossed overnight, without anyone
 * touching it.
 */
const Product = require('../../../models/Product');
const MarkdownSchedule = require('../models/MarkdownSchedule');

function setSchedule(input) {
  const { companyId, productId, variantId, launchDate, stages } = input;
  if (!stages || stages.length === 0) throw new Error('At least one stage is required.');
  const sorted = [...stages].sort((a, b) => a.daysSinceLaunch - b.daysSinceLaunch);
  if (sorted[0].daysSinceLaunch !== 0) throw new Error('The first stage must start at daysSinceLaunch: 0 (the launch price) — otherwise there\'s no defined price for the gap before the first stage.');

  return MarkdownSchedule.findOneAndUpdate(
    { variantId },
    { companyId, productId, variantId, launchDate: launchDate || new Date(), stages: sorted },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
}

function getSchedule(variantId) {
  return MarkdownSchedule.findOne({ variantId });
}

function listSchedules(companyId) {
  return MarkdownSchedule.find({ companyId }).populate('productId', 'name sellingPrice');
}

/**
 * The current effective price — walks the stages from the end to find the
 * highest daysSinceLaunch threshold that's actually been reached, same
 * "highest tier reached wins" logic Distribution's computePrice() uses,
 * applied to elapsed days instead of purchased quantity. The boundary day
 * itself counts (>=, not >) — the same convention every threshold check
 * in this app has used since Service Station established it.
 */
async function currentPrice(companyId, variantId) {
  const schedule = await MarkdownSchedule.findOne({ companyId, variantId });
  if (!schedule) {
    const product = await Product.findOne({ companyId, 'variants._id': variantId });
    const variant = product?.variants?.id(variantId);
    return { basePrice: variant?.sellingPrice ?? product?.sellingPrice ?? 0, discountPercent: 0, currentPrice: variant?.sellingPrice ?? product?.sellingPrice ?? 0, stageApplied: null, daysSinceLaunch: null };
  }

  const product = await Product.findOne({ companyId, 'variants._id': variantId });
  const variant = product?.variants?.id(variantId);
  const basePrice = variant?.sellingPrice ?? product?.sellingPrice ?? 0;

  const daysSinceLaunch = Math.floor((Date.now() - schedule.launchDate.getTime()) / (1000 * 60 * 60 * 24));

  let applicable = schedule.stages[0]; // always at least the day-0 stage, guaranteed by setSchedule's validation
  for (let i = schedule.stages.length - 1; i >= 0; i--) {
    if (daysSinceLaunch >= schedule.stages[i].daysSinceLaunch) { applicable = schedule.stages[i]; break; }
  }

  const discounted = Math.round(basePrice * (1 - applicable.discountPercent / 100) * 100) / 100;
  return {
    basePrice, discountPercent: applicable.discountPercent, currentPrice: discounted,
    stageApplied: applicable.daysSinceLaunch, daysSinceLaunch,
  };
}

module.exports = { setSchedule, getSchedule, listSchedules, currentPrice };
