const { Schema, model } = require('mongoose');

/**
 * ChannelOrder — an audit/log record of one inbound order from a
 * SalesChannel webhook, kept independent of whether the conversion into a
 * real Sale succeeded. rawPayload preserves exactly what the external
 * platform sent, for debugging/replay. Once successfully converted,
 * saleId points at the resulting Sale (same Sale model/pipeline the
 * existing single-channel ecommerceService.importOrder() already uses).
 */
const channelOrderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  salesChannelId: { type: Schema.Types.ObjectId, ref: 'SalesChannel', required: true, index: true },
  externalOrderId: { type: String, required: true },
  rawPayload: { type: Schema.Types.Mixed },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  status: { type: String, enum: ['received', 'processed', 'failed'], default: 'received' },
  errorNote: { type: String, default: null },
  receivedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Prevents the same external order from being processed twice (a platform
// retrying a webhook delivery, etc.)
channelOrderSchema.index({ salesChannelId: 1, externalOrderId: 1 }, { unique: true });

module.exports = model('ChannelOrder', channelOrderSchema);
