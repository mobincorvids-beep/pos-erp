/**
 * salesChannelService — multi-channel extension of ecommerceService.js.
 *
 * REUSED as-is: ecommerceService.importOrder(company, payload) is called
 * unchanged to do the actual order->Sale conversion (item matching by
 * barcode/sku, customer find-or-create, posSaleService.checkout()). Nothing
 * about that conversion logic was rewritten.
 *
 * ADAPTED (minimal): ecommerceService.importOrder() reads its
 * defaultBranchId/defaultWarehouseId/defaultPaymentAccountId from
 * company.ecommerceConfig, since the old single-channel model only ever had
 * one set of defaults per company. A SalesChannel now may carry its own
 * overrides in syncSettings ({ defaultBranchId, defaultWarehouseId,
 * defaultPaymentAccountId }) so e.g. "Daraz Marketplace" can settle into a
 * different warehouse/account than "Company Website". Rather than forking
 * importOrder(), receiveOrder() below builds a shallow-cloned company object
 * whose ecommerceConfig is the channel's overrides merged on top of the
 * company's existing config, and passes that clone to the untouched
 * importOrder(). If a channel sets no syncSettings overrides, this reduces
 * exactly to the company's existing single-channel defaults.
 */
const Company = require('../models/Company');
const SalesChannel = require('../models/SalesChannel');
const ChannelOrder = require('../models/ChannelOrder');
const ecommerceService = require('./ecommerceService');
const { nanoid } = require('nanoid');

async function createChannel(companyId, { name, channelType }) {
  if (!name || !name.trim()) throw new Error('Channel name is required.');
  const validTypes = ['shopify', 'woocommerce', 'daraz', 'custom_website', 'marketplace_other'];
  if (!validTypes.includes(channelType)) throw new Error(`channelType must be one of: ${validTypes.join(', ')}`);

  return SalesChannel.create({
    companyId,
    name: name.trim(),
    channelType,
    webhookToken: nanoid(32), // same generation approach as the existing single-channel token
  });
}

function listChannels(companyId) {
  return SalesChannel.find({ companyId }).sort({ createdAt: -1 });
}

async function toggleChannel(companyId, channelId) {
  const channel = await SalesChannel.findOne({ _id: channelId, companyId });
  if (!channel) throw new Error('Sales channel not found.');
  channel.isActive = !channel.isActive;
  await channel.save();
  return channel;
}

async function regenerateToken(companyId, channelId) {
  const channel = await SalesChannel.findOne({ _id: channelId, companyId });
  if (!channel) throw new Error('Sales channel not found.');
  channel.webhookToken = nanoid(32);
  await channel.save();
  return channel;
}

/**
 * Looks up the channel by its webhook token, records a ChannelOrder for
 * audit, and converts the payload into a real Sale via the existing
 * ecommerceService.importOrder(). Idempotent per (channel, externalOrderId):
 * a duplicate delivery of the same external order is recognized via the
 * unique index on ChannelOrder and returned as already-processed rather
 * than double-booked.
 *
 * @param {String} webhookToken
 * @param {Object} payload - { externalOrderId, items, customerEmail?, customerName?, customerPhone?, userId? }
 */
async function receiveOrder(webhookToken, payload) {
  const channel = await SalesChannel.findOne({ webhookToken });
  if (!channel) throw new Error('Invalid webhook token.');
  if (!channel.isActive) throw new Error('This sales channel is not active.');

  const { externalOrderId } = payload || {};
  if (!externalOrderId) throw new Error('externalOrderId is required.');

  let channelOrder;
  try {
    channelOrder = await ChannelOrder.create({
      companyId: channel.companyId,
      salesChannelId: channel._id,
      externalOrderId: String(externalOrderId),
      rawPayload: payload,
      status: 'received',
      receivedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) {
      // Already received this external order before — return the prior record rather than reprocessing.
      return ChannelOrder.findOne({ salesChannelId: channel._id, externalOrderId: String(externalOrderId) });
    }
    throw err;
  }

  const company = await Company.findById(channel.companyId);
  if (!company) throw new Error('Company not found for this sales channel.');

  // Merge channel-level overrides on top of the company's existing
  // single-channel ecommerceConfig defaults (see file header).
  const overrides = channel.syncSettings || {};
  const effectiveCompany = Object.assign(Object.create(Object.getPrototypeOf(company)), company.toObject());
  effectiveCompany._id = company._id;
  effectiveCompany.ecommerceConfig = {
    ...(company.ecommerceConfig ? company.ecommerceConfig.toObject?.() ?? company.ecommerceConfig : {}),
    ...(overrides.defaultBranchId ? { defaultBranchId: overrides.defaultBranchId } : {}),
    ...(overrides.defaultWarehouseId ? { defaultWarehouseId: overrides.defaultWarehouseId } : {}),
    ...(overrides.defaultPaymentAccountId ? { defaultPaymentAccountId: overrides.defaultPaymentAccountId } : {}),
  };

  try {
    const sale = await ecommerceService.importOrder(effectiveCompany, payload);
    channelOrder.saleId = sale._id;
    channelOrder.status = 'processed';
    await channelOrder.save();

    channel.lastSyncAt = new Date();
    channel.ordersReceivedCount += 1;
    await channel.save();

    return channelOrder;
  } catch (err) {
    channelOrder.status = 'failed';
    channelOrder.errorNote = err.message;
    await channelOrder.save();
    throw err;
  }
}

/** Orders received and revenue (of successfully processed orders), grouped per channel. */
async function channelAnalytics(companyId) {
  const channels = await SalesChannel.find({ companyId });
  const results = [];
  for (const channel of channels) {
    const orders = await ChannelOrder.find({ salesChannelId: channel._id });
    const processed = orders.filter((o) => o.status === 'processed');
    const revenue = 0; // populated below via Sale lookup
    results.push({
      channelId: channel._id,
      name: channel.name,
      channelType: channel.channelType,
      isActive: channel.isActive,
      ordersReceived: orders.length,
      ordersProcessed: processed.length,
      ordersFailed: orders.filter((o) => o.status === 'failed').length,
      revenue,
      processedSaleIds: processed.map((o) => o.saleId).filter(Boolean),
    });
  }

  // Compute revenue per channel from the linked Sale totals.
  const Sale = require('../models/Sale');
  for (const r of results) {
    if (r.processedSaleIds.length === 0) continue;
    const sales = await Sale.find({ _id: { $in: r.processedSaleIds } }, 'totalAmount grandTotal total');
    r.revenue = sales.reduce((sum, s) => sum + (s.grandTotal ?? s.totalAmount ?? s.total ?? 0), 0);
    delete r.processedSaleIds;
  }

  return results;
}

module.exports = { createChannel, listChannels, toggleChannel, regenerateToken, receiveOrder, channelAnalytics };
