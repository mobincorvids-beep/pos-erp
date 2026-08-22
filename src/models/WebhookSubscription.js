const { Schema, model } = require('mongoose');

// A company subscribing to be notified when something happens in THIS
// system — genuinely the opposite direction from the existing e-commerce
// webhook (that one is INBOUND: an external store calls US when an order
// happens on their end). This is OUTBOUND: we call THEM, whenever a real
// event we fire actually happens, the same real events the Notification
// Engine already hooks into (low_stock, approval_needed...) plus core
// business events (sale.completed). One subscription can listen for
// exactly one event type, or '*' for everything.
const webhookSubscriptionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  eventType: { type: String, required: true }, // 'sale.completed', 'low_stock', 'approval_needed', '*' for everything
  targetUrl: { type: String, required: true },
  secret: { type: String, required: true }, // used to HMAC-sign every delivery so the receiver can verify it genuinely came from here
  isActive: { type: Boolean, default: true },
  lastDeliveryStatus: { type: String, default: null }, // 'success' | 'failed' | null (never fired yet)
  lastDeliveryAt: { type: Date, default: null },
  lastFailureReason: { type: String, default: null },
}, { timestamps: true });

module.exports = model('WebhookSubscription', webhookSubscriptionSchema);
