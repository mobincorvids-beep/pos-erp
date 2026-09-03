/**
 * EcommerceService — order import and product feed for an external store.
 * importOrder() deliberately reuses posSaleService.checkout() rather than
 * writing its own stock/ledger logic — an online order has exactly the same
 * inventory and accounting effects as a counter sale, just tagged
 * channel:'ecommerce' and sourced from a different warehouse/payment
 * account (the company's configured defaults) instead of a cashier's picks.
 */
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const StockLevel = require('../models/StockLevel');
const User = require('../models/User');
const Role = require('../models/Role');
const posSaleService = require('./posSaleService');
const { nanoid } = require('nanoid');

/** Enables the integration and generates a webhook token, called once per store, or again to rotate the token. */
function enableAndRotateToken(company, { defaultBranchId, defaultWarehouseId, defaultPaymentAccountId }) {
  company.ecommerceConfig = {
    enabled: true,
    webhookToken: nanoid(32),
    defaultBranchId: defaultBranchId || company.ecommerceConfig?.defaultBranchId || null,
    defaultWarehouseId: defaultWarehouseId || company.ecommerceConfig?.defaultWarehouseId || null,
    defaultPaymentAccountId: defaultPaymentAccountId || company.ecommerceConfig?.defaultPaymentAccountId || null,
  };
  return company.save();
}

function disable(company) {
  company.ecommerceConfig.enabled = false;
  return company.save();
}

/**
 * Product + current stock feed for an external store to sync from. Only
 * simple/variant-tracked products with a barcode or SKU are included — an
 * external order references items by barcode/SKU (see importOrder), so a
 * product without either can't be ordered through this channel anyway.
 */
async function getProductFeed(companyId, warehouseId) {
  const products = await Product.find({ companyId, isActive: true, trackingMode: { $in: ['simple', 'variant'] } });

  const feed = [];
  for (const product of products) {
    for (const variant of product.variants) {
      if (!variant.isActive || (!variant.barcode && !variant.sku)) continue;

      let quantity = null;
      if (warehouseId) {
        const level = await StockLevel.findOne({ warehouseId, variantId: variant._id });
        quantity = level?.quantity || 0;
      }

      feed.push({
        productId: product._id, variantId: variant._id,
        name: product.name, sku: variant.sku || product.sku, barcode: variant.barcode || product.barcode,
        price: variant.sellingPrice ?? product.sellingPrice,
        quantityAvailable: quantity,
      });
    }
  }
  return feed;
}

/**
 * Imports an external order as a completed sale. Items are matched by
 * barcode first, then SKU (an external store's product export usually
 * carries one or the other). The customer is found-or-created by email —
 * this is the interlink point with the Customer/CRM module, not a separate
 * "e-commerce customer" record.
 *
 * @param {Object} company - must have ecommerceConfig.enabled and the three defaults set
 * @param {Object} payload - { items: [{ barcode?, sku?, quantity, unitPrice }], customerEmail?, customerName?, customerPhone? }
 */
async function importOrder(company, payload) {
  const { defaultBranchId, defaultWarehouseId, defaultPaymentAccountId } = company.ecommerceConfig || {};
  if (!defaultBranchId || !defaultWarehouseId || !defaultPaymentAccountId) {
    throw new Error('E-commerce integration is enabled but missing default branch/warehouse/payment account configuration.');
  }

  const { items, customerEmail, customerName, customerPhone, userId } = payload;
  if (!items || items.length === 0) throw new Error('Order must contain at least one item.');

  const resolvedItems = [];
  for (const item of items) {
    if (!item.barcode && !item.sku) throw new Error('Each order item needs a barcode or sku to be matched to a product.');

    const product = await Product.findOne({
      companyId: company._id,
      $or: [
        ...(item.barcode ? [{ barcode: item.barcode }, { 'variants.barcode': item.barcode }] : []),
        ...(item.sku ? [{ sku: item.sku }, { 'variants.sku': item.sku }] : []),
      ],
    });
    if (!product) throw new Error(`No product found for barcode/sku "${item.barcode || item.sku}".`);

    const variant = product.variants.find((v) =>
      (item.barcode && v.barcode === item.barcode) || (item.sku && v.sku === item.sku)
    ) || product.variants[0];
    if (!variant) throw new Error(`Product "${product.name}" has no sellable variant.`);

    resolvedItems.push({
      productId: product._id, variantId: variant._id,
      quantity: item.quantity, unitPrice: item.unitPrice ?? (variant.sellingPrice ?? product.sellingPrice),
    });
  }

  let customerId = null;
  if (customerEmail) {
    let customer = await Customer.findOne({ companyId: company._id, email: customerEmail });
    if (!customer) {
      customer = await Customer.create({ companyId: company._id, name: customerName || customerEmail, email: customerEmail, phone: customerPhone });
    }
    customerId = customer._id;
  }

  const totalAmount = resolvedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  // Online orders have no cashier. Attribute the sale to whichever user
  // triggered the import if given; otherwise fall back to this company's
  // Admin-role user, since Sale.userId is required by schema.
  //
  // The company's own owner/admin (created directly by onboardCompany) has
  // roleId: null — that's this app's super-admin convention (see
  // Role-based permission checks: permissions === null means "all access"),
  // not a dangling reference to a Role literally named "Admin". So the
  // fallback here tries three things in order: (1) a user assigned to a
  // Role named "Admin" (a starter-role-template admin, if the company has
  // one), (2) a roleId: null super-admin user (the onboarding owner), then
  // (3) any user at all in the company — never leave a valid company
  // unable to import orders just because none of its users happen to match
  // the first two shapes.
  let resolvedUserId = userId || null;
  if (!resolvedUserId) {
    const adminRole = await Role.findOne({ companyId: company._id, name: 'Admin' });
    const adminUser =
      (adminRole && await User.findOne({ companyId: company._id, roleId: adminRole._id })) ||
      await User.findOne({ companyId: company._id, roleId: null }) ||
      await User.findOne({ companyId: company._id });
    if (!adminUser) throw new Error('E-commerce order import needs a userId (no admin user found to attribute the sale to).');
    resolvedUserId = adminUser._id;
  }

  return posSaleService.checkout({
    companyId: company._id, branchId: defaultBranchId, warehouseId: defaultWarehouseId,
    customerId, channel: 'ecommerce',
    items: resolvedItems,
    userId: resolvedUserId,
    // Online orders are assumed prepaid — the external store already
    // collected payment before this webhook fires; this just records where
    // that money landed (the configured settlement account), it doesn't
    // process a real payment itself.
    payments: [{ paymentAccountId: defaultPaymentAccountId, method: 'online', amount: totalAmount }],
  });
}

module.exports = { enableAndRotateToken, disable, getProductFeed, importOrder };
