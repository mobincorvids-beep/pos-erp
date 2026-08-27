const crypto = require('crypto');
const DeveloperWebhookSubscription = require('../models/DeveloperWebhookSubscription');

async function createSubscription(companyId, { url, event, secret }) {
  if (!url) throw new Error('A webhook subscription needs a target URL.');
  if (!DeveloperWebhookSubscription.WEBHOOK_EVENTS.includes(event)) {
    throw new Error(`Unknown event "${event}". Valid events: ${DeveloperWebhookSubscription.WEBHOOK_EVENTS.join(', ')}`);
  }
  const sub = await DeveloperWebhookSubscription.create({
    companyId,
    url,
    event,
    // Auto-generate a signing secret if the caller didn't supply one —
    // same pattern as ApiKey's raw key: random, opaque, shown to the user
    // once in the create response (unlike the API key hash, the secret IS
    // stored in plaintext here, because delivery needs to re-sign every
    // payload — this mirrors Company.ecommerceConfig.webhookToken).
    secret: secret || crypto.randomBytes(24).toString('hex'),
  });
  return sub;
}

async function listSubscriptions(companyId) {
  return DeveloperWebhookSubscription.find({ companyId }).sort({ createdAt: -1 });
}

async function deleteSubscription(companyId, subscriptionId) {
  const result = await DeveloperWebhookSubscription.deleteOne({ _id: subscriptionId, companyId });
  if (result.deletedCount === 0) throw new Error('Webhook subscription not found.');
  return { deleted: true };
}

/**
 * Delivers `payload` to every active subscription this company has for
 * `event`, signing the JSON body with each subscription's own secret
 * (HMAC-SHA256, hex digest, sent as X-Webhook-Signature) so the receiver
 * can verify authenticity the same way Stripe/GitHub-style webhooks do.
 *
 * Deliberately fire-and-forget from the caller's point of view: network
 * calls to arbitrary third-party URLs are exactly the kind of thing that
 * must never be allowed to throw back into (or block) core business logic,
 * so every failure mode here is swallowed and recorded on the subscription
 * document instead of propagated.
 *
 * NOT wired into any existing business logic yet, on purpose (out of scope
 * for this change — those are shared files other work is touching). The
 * intended integration points, for whoever wires this in next:
 *   - sale.created:            end of posSaleService.checkout(), after the Sale is persisted
 *   - product.low_stock:       wherever inventoryService currently detects a stock level
 *                               crossing the reorder threshold (see its low-stock checks)
 *   - customer.created:        end of customerService's create/createCustomer function
 *   - purchase_order.received: end of the GRN/receive flow in the purchasing service
 * Each call site would do: await webhookSubscriptionService.triggerWebhook(companyId, '<event>', <document>);
 */
async function triggerWebhook(companyId, event, payload) {
  let subscriptions = [];
  try {
    subscriptions = await DeveloperWebhookSubscription.find({ companyId, event, isActive: true });
  } catch (err) {
    console.error('triggerWebhook: failed to load subscriptions', err);
    return;
  }

  await Promise.all(subscriptions.map(async (sub) => {
    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = crypto.createHmac('sha256', sub.secret).update(body).digest('hex');

    let status = 'success';
    try {
      const response = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body,
      });
      if (!response.ok) status = `failed:${response.status}`;
    } catch (err) {
      status = `failed:${err.message}`;
    }

    try {
      sub.lastTriggeredAt = new Date();
      sub.lastStatus = status;
      await sub.save();
    } catch (saveErr) {
      console.error('triggerWebhook: failed to record delivery status', saveErr);
    }
  }));
}

module.exports = { createSubscription, listSubscriptions, deleteSubscription, triggerWebhook };
