const { Schema, model } = require('mongoose');

/**
 * An external system's subscription to be notified when something happens
 * in this tenant's data (the outbound Integration Engine — see
 * src/services/webhookService.js for subscribe/fire/HMAC-SHA256 signing).
 * Mounted at /webhooks via webhookRoutes.js/webhookController.js.
 *
 * NOTE: a later Developer Platform module added its OWN webhook-subscription
 * concept under a *different* model name (DeveloperWebhookSubscription, see
 * src/models/DeveloperWebhookSubscription.js) specifically to avoid
 * colliding with this pre-existing, already-wired feature. Do not merge the
 * two without reconciling their different field shapes (eventType/targetUrl/
 * lastDeliveryStatus/lastDeliveryAt here vs event/url/lastStatus/
 * lastTriggeredAt there) and their different callers.
 */
const webhookSubscriptionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  eventType: { type: String, required: true },
  targetUrl: { type: String, required: true },
  secret: { type: String, required: true }, // used to HMAC-SHA256 sign each delivered payload
  isActive: { type: Boolean, default: true },
  lastDeliveryStatus: { type: String, default: null }, // 'success' | 'failed'
  lastDeliveryAt: { type: Date, default: null },
  lastFailureReason: { type: String, default: null },
}, { timestamps: true });

webhookSubscriptionSchema.index({ companyId: 1, eventType: 1, isActive: 1 });

module.exports = model('WebhookSubscription', webhookSubscriptionSchema);
