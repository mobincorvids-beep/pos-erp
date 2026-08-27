const { Schema, model } = require('mongoose');

/**
 * The Developer Platform's own webhook-subscription concept — deliberately
 * a SEPARATE model from src/models/WebhookSubscription.js (the pre-existing
 * outbound Integration Engine used by webhookService.js/webhookRoutes.js,
 * mounted at /webhooks). Both let a company register a URL to receive
 * events, but they were built independently with different field shapes
 * and different callers; renamed here to avoid a Mongoose model-registration
 * collision and to avoid silently repurposing the older, already-wired
 * feature. See DeveloperPlatformPage.jsx / apiKeyService.js for the sibling
 * inbound (API key) half of this module.
 */
const WEBHOOK_EVENTS = [
  'sale.created',
  'product.low_stock',
  'customer.created',
  'purchase_order.received',
];

const developerWebhookSubscriptionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  url: { type: String, required: true },
  event: { type: String, required: true, enum: WEBHOOK_EVENTS },
  secret: { type: String, required: true }, // used to HMAC-SHA256 sign each delivered payload
  isActive: { type: Boolean, default: true },
  lastTriggeredAt: { type: Date, default: null },
  lastStatus: { type: String, default: null }, // e.g. 'success', 'failed:<http-status>', 'failed:<error-message>'
}, { timestamps: true });

developerWebhookSubscriptionSchema.index({ companyId: 1, event: 1, isActive: 1 });

const DeveloperWebhookSubscription = model('DeveloperWebhookSubscription', developerWebhookSubscriptionSchema);
DeveloperWebhookSubscription.WEBHOOK_EVENTS = WEBHOOK_EVENTS;

module.exports = DeveloperWebhookSubscription;
