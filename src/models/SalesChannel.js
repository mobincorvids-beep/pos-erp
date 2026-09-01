const { Schema, model } = require('mongoose');

/**
 * SalesChannel — a named external order source ("My Shopify Store",
 * "Company Website", "Daraz Marketplace"). This generalizes the single
 * webhookToken the company-level ecommerceConfig used to carry (see
 * Company.ecommerceConfig / ecommerceService.js) into many, one per channel,
 * so a company can run several storefronts/marketplaces side by side feeding
 * the same order pipeline. That original single-channel config is left
 * completely untouched — it keeps working as-is, effectively "channel #1".
 */
const salesChannelSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true },
  channelType: {
    type: String,
    enum: ['shopify', 'woocommerce', 'daraz', 'custom_website', 'marketplace_other'],
    required: true,
  },
  // Same generation approach as Company.ecommerceConfig.webhookToken
  // (nanoid(32)) — see ecommerceService.enableAndRotateToken — kept
  // consistent so both schemes are equally strong/opaque.
  webhookToken: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  // Free-form per-channel config (e.g. default branch/warehouse/payment
  // account overrides, platform-specific mapping options). Deliberately
  // Mixed/flexible since channel types have very different needs.
  syncSettings: { type: Schema.Types.Mixed, default: {} },
  lastSyncAt: { type: Date, default: null },
  ordersReceivedCount: { type: Number, default: 0 },
}, { timestamps: true });

salesChannelSchema.index({ companyId: 1, isActive: 1 });

module.exports = model('SalesChannel', salesChannelSchema);
