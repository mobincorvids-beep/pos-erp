/**
 * JazzCash Mobile Wallet (MWALLET) integration — JazzCash's real "Page
 * Redirection" / Mobile Account API. A merchant request is a fixed set of
 * pp_* fields, signed by taking every non-empty field (pp_SecureHash
 * itself excluded), sorting the field NAMES alphabetically, joining the
 * VALUES with '&', and HMAC-SHA256'ing that string with the Integrity
 * Salt prefixed onto it (`${salt}&${joinedValues}`) — this is JazzCash's
 * actual documented algorithm, not invented here. The same procedure is
 * used in reverse to verify an inbound callback: recompute the hash over
 * the fields JazzCash sent us and compare against pp_SecureHash.
 *
 * Endpoints below are JazzCash's real documented hosts. The exact
 * DoMTransaction path can vary slightly by API version the merchant is
 * onboarded onto (2.0 vs later) — confirm the precise path against the
 * integration guide JazzCash's merchant support sends on go-live; the
 * host and general REST shape here are correct either way.
 */
const crypto = require('crypto');

const SANDBOX_BASE = 'https://sandbox.jazzcash.com.pk/ApplicationAPI/API/2.0/Purchase/DoMWalletTransaction';
const PRODUCTION_BASE = 'https://payments.jazzcash.com.pk/ApplicationAPI/API/2.0/Purchase/DoMWalletTransaction';

function isSandbox() {
  return (process.env.JAZZCASH_SANDBOX || 'true').toLowerCase() !== 'false';
}

function requireConfig() {
  const merchantId = process.env.JAZZCASH_MERCHANT_ID;
  const password = process.env.JAZZCASH_PASSWORD;
  const integritySalt = process.env.JAZZCASH_INTEGRITY_SALT;
  if (!merchantId || !password || !integritySalt) {
    throw new Error('JazzCash is not configured — set JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD and JAZZCASH_INTEGRITY_SALT.');
  }
  return { merchantId, password, integritySalt };
}

/**
 * JazzCash's actual signature algorithm: sort the field NAMES
 * alphabetically, drop any field with an empty/undefined value AND drop
 * pp_SecureHash itself, join the remaining VALUES with '&', prefix the
 * Integrity Salt, then HMAC-SHA256 and hex-encode.
 */
function computeSecureHash(fields, integritySalt) {
  const names = Object.keys(fields)
    .filter((k) => k !== 'pp_SecureHash' && fields[k] !== undefined && fields[k] !== null && fields[k] !== '')
    .sort();
  const joined = names.map((k) => fields[k]).join('&');
  const toHash = `${integritySalt}&${joined}`;
  return crypto.createHmac('sha256', integritySalt).update(toHash).digest('hex').toUpperCase();
}

function formatDateTime(date) {
  // JazzCash expects yyyyMMddHHmmss, no separators.
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * Initiates a Mobile Wallet transaction. `amount` is in the company's base
 * currency's smallest whole-rupee unit (JazzCash's pp_Amount is in paisa,
 * i.e. rupees * 100, with no decimal point) and `phone` must be the
 * customer's JazzCash mobile account number (03XXXXXXXXX).
 */
async function initiateMobileWalletTransaction({ amount, phone, orderRef }) {
  if (!amount || amount <= 0) throw new Error('JazzCash: amount must be greater than zero.');
  if (!phone || !/^03\d{9}$/.test(phone)) throw new Error('JazzCash: phone must be a valid Pakistani mobile number (03XXXXXXXXX).');
  if (!orderRef) throw new Error('JazzCash: orderRef is required.');

  const { merchantId, password, integritySalt } = requireConfig();
  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour, matches JazzCash's default DateTime expiry window

  const fields = {
    pp_Version: '2.0',
    pp_TxnType: 'MWALLET',
    pp_Language: 'EN',
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_TxnRefNo: orderRef,
    pp_Amount: String(Math.round(amount * 100)), // paisa, integer, no decimal
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: formatDateTime(now),
    pp_BillReference: orderRef,
    pp_Description: `POS sale ${orderRef}`,
    pp_TxnExpiryDateTime: formatDateTime(expiry),
    pp_MobileNumber: phone,
    pp_CNIC: '', // last 6 digits of CNIC — optional for MWALLET per spec, left blank unless collected at checkout
  };
  fields.pp_SecureHash = computeSecureHash(fields, integritySalt);

  const endpoint = isSandbox() ? SANDBOX_BASE : PRODUCTION_BASE;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });

  const raw = await response.json().catch(() => null);
  if (!response.ok || !raw) {
    throw new Error(`JazzCash request failed (HTTP ${response.status}).`);
  }

  // pp_ResponseCode '000' is JazzCash's documented success code for a
  // completed MWALLET debit; anything else is a decline/failure/pending
  // state described in pp_ResponseMessage.
  const success = raw.pp_ResponseCode === '000';
  return {
    success,
    providerTransactionId: raw.pp_TxnRefNo || orderRef,
    responseCode: raw.pp_ResponseCode,
    responseMessage: raw.pp_ResponseMessage,
    raw,
  };
}

/** Verifies an inbound JazzCash callback/return payload by recomputing pp_SecureHash the same way and comparing with a timing-safe comparison. */
function verifyCallback(payload) {
  const { integritySalt } = requireConfig();
  const providedHash = payload.pp_SecureHash;
  if (!providedHash) return { valid: false, reason: 'Missing pp_SecureHash.' };

  const expectedHash = computeSecureHash(payload, integritySalt);
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const providedBuffer = Buffer.from(String(providedHash).toUpperCase(), 'hex');
  const valid = expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  return {
    valid,
    success: valid && payload.pp_ResponseCode === '000',
    providerTransactionId: payload.pp_TxnRefNo,
    responseCode: payload.pp_ResponseCode,
    responseMessage: payload.pp_ResponseMessage,
  };
}

module.exports = { initiateMobileWalletTransaction, verifyCallback, computeSecureHash, isSandbox };
