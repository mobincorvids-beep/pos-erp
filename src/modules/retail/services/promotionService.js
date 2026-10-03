const Promotion = require('../models/Promotion');

function createPromotion(input) {
  const { companyId, branchId, name, type } = input;
  if (!name) throw new Error('name is required.');
  if (type === 'buy_x_get_y') {
    if (!input.triggerVariantId || !input.triggerQuantity) throw new Error('triggerVariantId and triggerQuantity are required for a buy-X-get-Y promotion.');
    if (!input.rewardVariantId || !input.rewardQuantity) throw new Error('rewardVariantId and rewardQuantity are required for a buy-X-get-Y promotion.');
    if (input.rewardDiscountPercent == null) throw new Error('rewardDiscountPercent is required for a buy-X-get-Y promotion.');
  } else if (type === 'bundle') {
    if (!input.bundleItems?.length) throw new Error('bundleItems is required for a bundle promotion.');
    if (!input.bundlePrice || input.bundlePrice <= 0) throw new Error('bundlePrice must be greater than zero for a bundle promotion.');
  } else {
    throw new Error('type must be "buy_x_get_y" or "bundle".');
  }
  return Promotion.create({ ...input, companyId, branchId: branchId || null });
}

function listPromotions(companyId, { branchId, activeOnly } = {}) {
  const filter = { companyId };
  if (branchId) filter.$or = [{ branchId: null }, { branchId }];
  if (activeOnly === 'true' || activeOnly === true) filter.active = true;
  return Promotion.find(filter).sort({ createdAt: -1 });
}

async function setActive(promotionId, active) {
  const promo = await Promotion.findByIdAndUpdate(promotionId, { active }, { new: true });
  if (!promo) throw new Error('Promotion not found.');
  return promo;
}

function isCurrentlyWindowed(promo, at = new Date()) {
  if (promo.startDate && at < promo.startDate) return false;
  if (promo.endDate && at > promo.endDate) return false;
  return true;
}

/**
 * Evaluates a cart (the same shape the POS screen already holds —
 * [{ variantId, quantity, unitPrice }]) against every active promotion
 * and returns which ones qualify and how much each is worth, so staff
 * can apply the discount as an ordinary line-level discount at checkout —
 * the same quote-then-manually-apply shape loyalty redemption and
 * buyback credit already use elsewhere in this app. Never mutates the
 * cart or calls checkout itself.
 */
async function evaluateCart(companyId, { branchId, items }) {
  if (!items?.length) return { eligible: [] };
  const promos = await listPromotions(companyId, { branchId, activeOnly: true });
  const now = new Date();
  const cartByVariant = new Map(items.map((i) => [String(i.variantId), i]));
  const eligible = [];

  for (const promo of promos) {
    if (!isCurrentlyWindowed(promo, now)) continue;

    if (promo.type === 'buy_x_get_y') {
      const triggerLine = cartByVariant.get(String(promo.triggerVariantId));
      if (!triggerLine || triggerLine.quantity < promo.triggerQuantity) continue;
      const timesQualified = Math.floor(triggerLine.quantity / promo.triggerQuantity);
      const rewardLine = cartByVariant.get(String(promo.rewardVariantId));
      const rewardUnitsInCart = rewardLine ? rewardLine.quantity : 0;
      const rewardUnitsEligible = Math.min(timesQualified * promo.rewardQuantity, rewardUnitsInCart);
      if (rewardUnitsEligible <= 0) continue;
      const rewardUnitPrice = rewardLine.unitPrice;
      const discountAmount = Math.round(rewardUnitsEligible * rewardUnitPrice * (promo.rewardDiscountPercent / 100) * 100) / 100;
      eligible.push({
        promotionId: promo._id, name: promo.name, type: 'buy_x_get_y',
        rewardVariantId: promo.rewardVariantId, rewardUnitsEligible, discountAmount,
        description: `${promo.name}: ${rewardUnitsEligible} unit(s) at ${promo.rewardDiscountPercent}% off`,
      });
      continue;
    }

    // bundle
    const allPresent = promo.bundleItems.every((bi) => {
      const line = cartByVariant.get(String(bi.variantId));
      return line && line.quantity >= bi.quantity;
    });
    if (!allPresent) continue;
    const normalTotal = promo.bundleItems.reduce((sum, bi) => {
      const line = cartByVariant.get(String(bi.variantId));
      return sum + bi.quantity * line.unitPrice;
    }, 0);
    const discountAmount = Math.round(Math.max(normalTotal - promo.bundlePrice, 0) * 100) / 100;
    if (discountAmount <= 0) continue;
    eligible.push({
      promotionId: promo._id, name: promo.name, type: 'bundle',
      bundlePrice: promo.bundlePrice, normalTotal, discountAmount,
      description: `${promo.name}: bundle price ${promo.bundlePrice} (normally ${normalTotal})`,
    });
  }

  return { eligible };
}

module.exports = { createPromotion, listPromotions, setActive, evaluateCart };
