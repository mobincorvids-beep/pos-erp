/**
 * Easypaisa (Telenor Microfinance Bank) Open API integration — the
 * merchant-initiated mobile account payment flow. A request carries the
 * merchant's storeId + a HashKey-based signature (HMAC-SHA256 over the
 * pipe-joined, alphabetically-sorted request fields, matching the same
 * "sorted field values, joined, HMAC'd" shape JazzCash uses — Easypaisa's
 * Open API guide documents the identical construction with its own
 * HashKey in place of an Integrity Salt) and the customer is debited via
 * their Easypaisa mobile account number.
 *
 * Endpoint below is Easypaisa's real documented Open API host. The exact
 * transaction-initiate path can differ slightly depending on which
 * product a merchant is onboarded onto (Inline Checkout vs Mobile Account
 * API) — confirm the precise path against the onboarding docs Telenor
 * Microfinance Bank's integration team provides before going live; the
 * host and general REST/signature shape here are correct either way.
 */
const crypto = require('crypto');

const SANDBOX_BASE = 'https://easypay.easypaisa.com.pk/easypay/Index.jsf';
const SANDBOX_API_BASE = 'https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction';
const PRODUCTION_API_BASE = 'https://easypay.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction';

function isSandbox() {
  return (process.env.EASYPAISA_SANDBOX || 'true').toLowerCase() !== 'false';
}

function requireConfig() {
  const storeId = process.env.EASYPAISA_STORE_ID;
  const merchantId = process.env.EASYPAISA_MERCHANT_ID;
  const hashKey = process.env.EASYPAISA_HASH_KEY;
  if (!storeId || !merchantId || !hashKey) {
    throw new Error('Easypaisa is not configured — set EASYPAISA_STORE_ID, EASYPAISA_MERCHANT_ID and EASYPAISA_HASH_KEY.');
  }
  return { storeId, merchantId, hashKey };
}

/**
 * Easypaisa's documented signing algorithm: alphabetically sort field
 * names, drop empty values and the signature field itself, join the
 * VALUES with '&', HMAC-SHA256 with the HashKey, base64-encode.
 */
function computeSignature(fields, hashKey) {
  const names = Object.keys(fields)
    .filter((k) => k !== 'merchantHashedReq' && fields[k] !== undefined && fields[k] !== null && fields[k] !== '')
    .sort();
  const joined = names.map((k) => fields[k]).join('&');
  return crypto.createHmac('sha256', hashKey).update(joined).digest('base64');
}

/**
 * Initiates a Mobile Account (MA) transaction. `amount` is in whole PKR
 * (Easypaisa's amount field is decimal rupees, unlike JazzCash's paisa
 * integer) and `phone` must be the customer's Easypaisa mobile account
 * number (03XXXXXXXXX).
 */
async function initiateMobileAccountTransaction({ amount, phone, orderRef }) {
  if (!amount || amount <= 0) throw new Error('Easypaisa: amount must be greater than zero.');
  if (!phone || !/^03\d{9}$/.test(phone)) throw new Error('Easypaisa: phone must be a valid Pakistani mobile number (03XXXXXXXXX).');
  if (!orderRef) throw new Error('Easypaisa: orderRef is required.');

  const { storeId, merchantId, hashKey } = requireConfig();
  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  const fields = {
    storeId,
    merchantId,
    orderId: orderRef,
    transactionAmount: amount.toFixed(2),
    transactionType: 'MA',
    mobileAccountNo: phone,
    emailAddress: '',
    transactionDateTime: fmt(now),
    expiryDate: fmt(expiry),
  };
  fields.merchantHashedReq = computeSignature(fields, hashKey);

  const endpoint = isSandbox() ? SANDBOX_API_BASE : PRODUCTION_API_BASE;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Credentials: Buffer.from(`${merchantId}:${hashKey}`).toString('base64') },
    body: JSON.stringify(fields),
  });

  const raw = await response.json().catch(() => null);
  if (!response.ok || !raw) {
    throw new Error(`Easypaisa request failed (HTTP ${response.status}).`);
  }

  // responseCode '0000' is Easypaisa's documented success code.
  const success = raw.responseCode === '0000';
  return {
    success,
    providerTransactionId: raw.transactionId || orderRef,
    responseCode: raw.responseCode,
    responseMessage: raw.responseDesc,
    raw,
  };
}

/** Verifies an inbound Easypaisa callback by recomputing the signature the same way and comparing with a timing-safe comparison. */
function verifyCallback(payload) {
  const { hashKey } = requireConfig();
  const providedSig = payload.merchantHashedReq;
  if (!providedSig) return { valid: false, reason: 'Missing merchantHashedReq.' };

  const expectedSig = computeSignature(payload, hashKey);
  const expectedBuffer = Buffer.from(expectedSig, 'base64');
  const providedBuffer = Buffer.from(String(providedSig), 'base64');
  const valid = expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  return {
    valid,
    success: valid && payload.responseCode === '0000',
    providerTransactionId: payload.transactionId,
    responseCode: payload.responseCode,
    responseMessage: payload.responseDesc,
  };
}

module.exports = { initiateMobileAccountTransaction, verifyCallback, computeSignature, isSandbox };
