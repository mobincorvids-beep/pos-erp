/**
 * PriceListService — customer-group and quantity-slab pricing. A PriceList
 * is a named price book ("Retail", "Wholesale", "Distributor") holding, per
 * product/variant, one or more quantity-break tiers. A Customer resolves
 * its applicable PriceList through (in order): its own priceListId, then
 * its priceGroupId matched against a PriceList.priceGroupId, then the
 * company's default PriceList, then falls back to the product's own
 * sellingPrice — so a variant/customer with nothing configured behaves
 * exactly as it did before this feature existed.
 */
const mongoose = require('mongoose');
const PriceList = require('../models/PriceList');
const Customer = require('../models/Customer');
const Product = require('../models/Product');

function create(companyId, input) {
  return PriceList.create({ ...input, companyId });
}

function update(companyId, id, input) {
  const allowed = ['name', 'priceGroupId', 'isDefault', 'entries'];
  const updates = {};
  for (const key of allowed) if (input[key] !== undefined) updates[key] = input[key];
  return PriceList.findOneAndUpdate({ _id: id, companyId }, updates, { new: true, runValidators: true });
}

function list(companyId) {
  return PriceList.find({ companyId }).populate('priceGroupId', 'name').sort({ name: 1 });
}

function get(companyId, id) {
  return PriceList.findOne({ _id: id, companyId });
}

function remove(companyId, id) {
  return PriceList.findOneAndDelete({ _id: id, companyId });
}

/** Which PriceList (if any) applies to this customer, per the precedence described above. */
async function resolvePriceListForCustomer(companyId, customerId) {
  if (customerId) {
    const customer = await Customer.findOne({ _id: customerId, companyId });
    if (customer?.priceListId) {
      const direct = await PriceList.findOne({ _id: customer.priceListId, companyId });
      if (direct) return direct;
    }
    if (customer?.priceGroupId) {
      const byGroup = await PriceList.findOne({ companyId, priceGroupId: customer.priceGroupId });
      if (byGroup) return byGroup;
    }
  }
  return PriceList.findOne({ companyId, isDefault: true });
}

/**
 * The unit price for `quantity` of a product/variant, resolved through the
 * customer's PriceList first, then the highest tier <= quantity within the
 * matching entry, then the product's own sellingPrice if nothing is
 * configured for this variant (or no PriceList applies at all) — mirrors
 * distributionPricingService.computePrice's fallback shape.
 */
async function resolvePrice(companyId, { customerId, productId, variantId, quantity }) {
  const priceList = await resolvePriceListForCustomer(companyId, customerId);

  if (priceList) {
    const entry = priceList.entries.find((e) =>
      String(e.productId) === String(productId) && (!e.variantId || String(e.variantId) === String(variantId))
    );
    if (entry) {
      const sorted = [...entry.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
      let applicable = null;
      for (const tier of sorted) {
        if (quantity >= tier.minQuantity) applicable = tier;
      }
      if (applicable) {
        return { unitPrice: applicable.unitPrice, priceListId: priceList._id, priceListName: priceList.name, tierApplied: applicable.minQuantity };
      }
    }
  }

  const product = await Product.findOne({ companyId, 'variants._id': variantId });
  const variant = product?.variants?.id ? product.variants.id(variantId) : null;
  const fallback = variant?.sellingPrice ?? product?.sellingPrice ?? 0;
  return { unitPrice: fallback, priceListId: null, priceListName: null, tierApplied: null };
}

module.exports = { create, update, list, get, remove, resolvePriceListForCustomer, resolvePrice };
