/**
 * WebhookService — the actual outbound Integration Engine this app was
 * missing beyond the one e-commerce-specific inbound webhook. subscribe()
 * registers a target URL for one event type; fire() is called from
 * wherever a real business event actually happens (mirroring exactly how
 * the Notification Engine's notify() is called — same "only exists
 * because something real happened" principle), and delivers a genuinely
 * HMAC-SHA256-signed payload so the receiver can verify it actually came
 * from here and wasn't forged or tampered with in transit — the standard
 * approach real webhook providers (Stripe, GitHub) use, not invented
 * fresh for this, since there was no existing signing pattern anywhere
 * else in this codebase to follow.
 */
const crypto = require('crypto');
const WebhookSubscription = require('../models/WebhookSubscription');

function subscribe({ companyId, eventType, targetUrl, secret }) {
  if (!eventType || !targetUrl) throw new Error('eventType and targetUrl are required.');
  return WebhookSubscription.create({
    companyId, eventType, targetUrl,
    secret: secret || crypto.randomBytes(32).toString('hex'), // auto-generate a real secret if the caller doesn't supply one — never leave it blank
  });
}

function listSubscriptions(companyId) {
  return WebhookSubscription.find({ companyId });
}

async function unsubscribe(subscriptionId) {
  const sub = await WebhookSubscription.findByIdAndUpdate(subscriptionId, { isActive: false }, { new: true });
  if (!sub) throw new Error('Webhook subscription not found.');
  return sub;
}

function signPayload(payload, secret) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return { body, signature };
}

/**
 * Fires an event to every active subscription matching it (exact
 * eventType match, or a subscription listening to '*' for everything).
 * Each delivery is attempted independently — one subscriber's endpoint
 * being down never blocks or fails delivery to any other subscriber, the
 * same "one recipient failing doesn't abort the batch" principle
 * CRM campaign sending already established.
 */
async function fire(companyId, eventType, payload) {
  const subscriptions = await WebhookSubscription.find({
    companyId, isActive: true,
    $or: [{ eventType }, { eventType: '*' }],
  });

  const results = [];
  for (const sub of subscriptions) {
    const { body, signature } = signPayload({ eventType, data: payload, firedAt: new Date().toISOString() }, sub.secret);
    try {
      const response = await fetch(sub.targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature, 'X-Webhook-Event': eventType },
        body,
      });
      const success = response.ok;
      sub.lastDeliveryStatus = success ? 'success' : 'failed';
      sub.lastDeliveryAt = new Date();
      sub.lastFailureReason = success ? null : `HTTP ${response.status}`;
      await sub.save();
      results.push({ subscriptionId: sub._id, success });
    } catch (err) {
      sub.lastDeliveryStatus = 'failed';
      sub.lastDeliveryAt = new Date();
      sub.lastFailureReason = err.message;
      await sub.save();
      results.push({ subscriptionId: sub._id, success: false, error: err.message });
    }
  }
  return results;
}

/** For a receiver to verify a delivery genuinely came from here and wasn't tampered with — recomputes the same HMAC and compares using a timing-safe comparison, not a plain === (which would leak timing information about how many leading bytes matched). */
function verifySignature(body, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== providedBuffer.length) return false; // timingSafeEqual throws on mismatched lengths rather than returning false — guard explicitly
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

module.exports = { subscribe, listSubscriptions, unsubscribe, fire, signPayload, verifySignature };
