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

module.exports = { initiatePayment, verifyCallback, PROVIDERS };
