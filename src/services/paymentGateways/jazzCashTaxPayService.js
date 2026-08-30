/**
 * JazzCash Bill Payment / Tax Payment integration — used ONLY for a
 * vendor/tenant paying their OWN tax liability to FBR, not for
 * customer-facing checkout (see jazzCashService.js for that). JazzCash
 * markets this under their "Bill Payment" API family, which uses the same
 * documented pp_* field + secure-hash signing convention as the MWALLET
 * flow in jazzCashService.js (sort field NAMES alphabetically, drop empty
 * fields and pp_SecureHash itself, join VALUES with '&', prefix the
 * Integrity Salt, HMAC-SHA256 and hex-encode) — that's real JazzCash
 * practice, not invented here, so this file mirrors jazzCashService.js's
 * structure exactly and reuses its computeSecureHash implementation since
 * the signing algorithm is identical, only the field SET (a bill/tax
 * payment carries pp_BillReference/pp_TxnType='MPAY' instead of
 * pp_MobileNumber-driven MWALLET fields) and the target endpoint differ.
 *
 * IMPORTANT — confirm before go-live: the exact pp_TxnType value
 * (`MPAY` is used below as JazzCash's documented Bill Payment code; some
 * merchant onboardings use a differently named "Retail/Bill Payment"
 * product) and the exact endpoint path must be confirmed against
 * JazzCash's merchant tax-payment integration guide, the same caveat
 * fbrService.js and jazzCashService.js already flag for their own
 * endpoints — JazzCash's tax-payment product is provisioned per merchant
 * and the guide sent at onboarding is authoritative.
 *
 * Credentials here are PER-TENANT (Company.jazzCashTaxPay), passed in by
 * the caller — NOT read from process.env — because each vendor connects
 * their own JazzCash merchant account for paying their own tax, unlike
 * the platform-wide JAZZCASH_* env vars jazzCashService.js uses for POS
 * checkout.
 */
const crypto = require('crypto');
const { computeSecureHash, isSandbox } = require('./jazzCashService');

const SANDBOX_BASE = 'https://sandbox.jazzcash.com.pk/ApplicationAPI/API/2.0/Purchase/DoBillPayment';
const PRODUCTION_BASE = 'https://payments.jazzcash.com.pk/ApplicationAPI/API/2.0/Purchase/DoBillPayment';

function formatDateTime(date) {
  // JazzCash expects yyyyMMddHHmmss, no separators — same format jazzCashService.js uses.
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function requireCredentials(config) {
  const { merchantId, password, integritySalt } = config || {};
  if (!merchantId || !password || !integritySalt) {
    throw new Error('JazzCash tax-pay is not configured for this company — set merchantId, password and integritySalt under Settings.');
  }
  return { merchantId, password, integritySalt };
}

/**
 * Initiates a Bill Payment / Tax Payment transaction against the vendor's
 * own JazzCash merchant credentials, sending funds toward the given FBR
 * account. `amount` is in whole rupees (converted to paisa below, matching
 * jazzCashService.js's pp_Amount convention).
 *
 * @param {Object} params
 * @param {Object} params.config - Company.jazzCashTaxPay { merchantId, password, integritySalt }
 * @param {Number} params.amount
 * @param {String} params.fbrAccountNumber
 * @param {String} params.billReference - our own reference (e.g. TaxPayment._id)
 */
async function initiateTaxPayment({ config, amount, fbrAccountNumber, billReference }) {
  if (!amount || amount <= 0) throw new Error('JazzCash tax-pay: amount must be greater than zero.');
  if (!fbrAccountNumber) throw new Error('JazzCash tax-pay: fbrAccountNumber is required.');
  if (!billReference) throw new Error('JazzCash tax-pay: billReference is required.');

  const { merchantId, password, integritySalt } = requireCredentials(config);
  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60 * 1000);

  const fields = {
    pp_Version: '2.0',
    // Bill Payment transaction type — CONFIRM against JazzCash's tax-payment
    // integration guide before go-live (see file header comment).
    pp_TxnType: 'MPAY',
    pp_Language: 'EN',
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_TxnRefNo: billReference,
    pp_Amount: String(Math.round(amount * 100)), // paisa, integer, no decimal
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: formatDateTime(now),
    pp_BillReference: billReference,
    pp_Description: `FBR tax payment ${billReference}`,
    pp_TxnExpiryDateTime: formatDateTime(expiry),
    // Destination FBR-designated account — field name/position to confirm
    // against the tax-payment guide; carried here as the bill reference's
    // companion field per JazzCash's general Bill Payment shape.
    pp_BillAccountNumber: fbrAccountNumber,
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
    throw new Error(`JazzCash tax-pay request failed (HTTP ${response.status}).`);
  }

  const success = raw.pp_ResponseCode === '000';
  return {
    success,
    providerTransactionId: raw.pp_TxnRefNo || billReference,
    responseCode: raw.pp_ResponseCode,
    responseMessage: raw.pp_ResponseMessage,
    raw,
  };
}

/** Verifies an inbound JazzCash tax-pay callback, same recompute-and-compare approach as jazzCashService.verifyCallback. */
function verifyTaxPaymentCallback({ config, payload }) {
  const { integritySalt } = requireCredentials(config);
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

module.exports = { initiateTaxPayment, verifyTaxPaymentCallback };
