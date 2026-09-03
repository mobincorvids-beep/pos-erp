/**
 * PaymentGatewayService — the swappable adapter layer over Pakistani
 * mobile-wallet payment gateways. This is the ONE module the rest of the
 * app should ever import for online payment; jazzCashService and
 * easypaisaService are implementation details dispatched to from here,
 * the same "one seam the rest of the app depends on" shape
 * defaultAccountsService already uses for swappable account resolution.
 * Adding a third provider later means adding one more case to each
 * function here, not touching every caller.
 */
const jazzCashService = require('./paymentGateways/jazzCashService');
const easypaisaService = require('./paymentGateways/easypaisaService');

const PROVIDERS = ['jazzcash', 'easypaisa'];

function assertProvider(provider) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported payment gateway provider: ${provider}. Supported: ${PROVIDERS.join(', ')}.`);
  }
}

/**
 * Initiates an online payment with the given provider. Returns a normalized
 * shape regardless of which provider handled it: { success, providerTransactionId, responseCode, responseMessage, raw }.
 */
async function initiatePayment({ provider, amount, phone, orderRef }) {
  assertProvider(provider);
  if (provider === 'jazzcash') {
    return jazzCashService.initiateMobileWalletTransaction({ amount, phone, orderRef });
  }
  return easypaisaService.initiateMobileAccountTransaction({ amount, phone, orderRef });
}

/**
 * Verifies an inbound callback payload from the given provider. Returns a
 * normalized shape: { valid, success, providerTransactionId, responseCode, responseMessage }.
 * `valid` reflects signature integrity; `success` reflects the payment
 * outcome and is only meaningful when `valid` is true — callers must check
 * `valid` before trusting `success` at all.
 */
function verifyCallback({ provider, payload }) {
  assertProvider(provider);
  if (provider === 'jazzcash') return jazzCashService.verifyCallback(payload);
  return easypaisaService.verifyCallback(payload);
}

/**
 * Creates an online checkout session/intent for a specific order, through
 * the same swappable provider abstraction as initiatePayment — this is the
 * "create session" call that was missing for a storefront checkout flow:
 * initiatePayment() already does the actual provider call, this just
 * normalizes it around an orderId/amount pair and a normalized
 * { checkoutId, redirectUrl, provider, raw } shape a storefront can act on
 * without knowing which gateway is behind it. Does not persist anything —
 * the caller (e.g. ecommerce checkout controller) is responsible for
 * recording the returned checkoutId against its own Order/Sale record if
 * it wants to reconcile the later callback (see verifyCallback).
 *
 * @param {String} companyId
 * @param {String} orderId - the Sale/order this checkout is for; used only as orderRef, not looked up here
 * @param {Number} amount
 * @param {Object} [opts]
 * @param {String} [opts.provider] - defaults to the first configured PROVIDERS entry ('jazzcash')
 * @param {String} [opts.phone] - required by both current providers (mobile-wallet checkout)
 */
async function createCheckoutIntent(companyId, orderId, amount, { provider = PROVIDERS[0], phone } = {}) {
  if (!orderId) throw new Error('orderId is required.');
  if (!amount || amount <= 0) throw new Error('amount must be greater than zero.');
  assertProvider(provider);

  const result = await initiatePayment({ provider, amount, phone, orderRef: String(orderId) });

  return {
    provider,
    checkoutId: result.providerTransactionId || null,
    // Neither current provider (jazzCashService/easypaisaService) returns a
    // hosted redirect URL today — both are mobile-wallet push/PIN flows
    // rather than a browser-redirect checkout — so redirectUrl is null
    // until a provider that has one is added; the shape is reserved for it.
    redirectUrl: result.redirectUrl || null,
    success: result.success,
    responseMessage: result.responseMessage,
    raw: result.raw,
  };
}

module.exports = { initiatePayment, verifyCallback, createCheckoutIntent, PROVIDERS };
