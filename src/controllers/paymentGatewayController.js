/**
 * Controller for the online payment gateway layer. `initiate` is
 * authenticated/company-scoped, called from the POS UI when a cashier
 * picks JazzCash/Easypaisa as the tender. `callback` is deliberately
 * PUBLIC — it's hit directly by JazzCash's/Easypaisa's own servers, which
 * have no session with this app and no bearer token, exactly like
 * ecommerceWebhookController's inbound calls; its ONLY authentication is
 * the provider's signature, verified via paymentGatewayService before a
 * single byte of the payload is trusted. `getStatus` is the small
 * poll-me endpoint the frontend hits every few seconds while waiting for
 * the customer to approve payment on their phone.
 */
const crypto = require('crypto');
const PaymentGatewayTransaction = require('../models/PaymentGatewayTransaction');
const paymentGatewayService = require('../services/paymentGatewayService');

async function initiate(req, res) {
  try {
    const { provider, amount, phone } = req.body;
    if (!provider || !amount || !phone) {
      return res.status(400).json({ error: 'provider, amount and phone are required.' });
    }

    const orderRef = `PGW-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const transaction = await PaymentGatewayTransaction.create({
      companyId: req.companyId,
      provider,
      orderRef,
      phone,
      amount,
      status: 'pending',
      initiatedByUserId: req.auth.userId,
    });

    let result;
    try {
      result = await paymentGatewayService.initiatePayment({ provider, amount, phone, orderRef });
    } catch (err) {
      transaction.status = 'failed';
      transaction.responseMessage = err.message;
      await transaction.save();
      return res.status(502).json({ error: err.message, transactionId: transaction._id });
    }

    transaction.providerTransactionId = result.providerTransactionId || null;
    transaction.responseCode = result.responseCode || null;
    transaction.responseMessage = result.responseMessage || null;
    transaction.rawResponse = result.raw || null;
    // Most MWALLET/MA flows return an immediate accept/decline synchronously
    // and only truly "pending" states wait on the provider's own callback —
    // reflect that here rather than always leaving it pending until a
    // callback arrives, since a callback may never come for an immediate decline.
    if (result.success) transaction.status = 'completed';
    else if (result.responseCode) transaction.status = 'failed';
    await transaction.save();

    // The Sale itself is deliberately NOT created here. It's finalized the
    // normal way — the frontend calls the existing POST /sales/checkout
    // once this transaction's status reads 'completed' (via the poll
    // endpoint below), with a payments entry
    // { paymentAccountId, method: provider, amount }, so it runs through
    // posSaleService.checkout's existing ledger-posting logic unchanged
    // rather than a parallel accounting path being built here. This
    // endpoint's whole job is getting money moved and status confirmed.
    res.status(201).json({
      transactionId: transaction._id,
      status: transaction.status,
      provider,
      orderRef,
      responseCode: transaction.responseCode,
      responseMessage: transaction.responseMessage,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * PUBLIC — hit by JazzCash/Easypaisa's own servers, not by our frontend.
 * No requireAuth/scopeToCompany in front of this route; the transaction's
 * own companyId (looked up by orderRef, never trusted from the payload)
 * is the only tenant scoping available, exactly like ecommerceWebhookController.
 */
async function callback(req, res) {
  try {
    const provider = req.params.provider;
    if (!['jazzcash', 'easypaisa'].includes(provider)) {
      return res.status(400).json({ error: 'Unknown provider.' });
    }

    const verification = paymentGatewayService.verifyCallback({ provider, payload: req.body });
    if (!verification.valid) {
      // Never trust or act on a payload whose signature doesn't check out
      // — respond 200 so the provider doesn't endlessly retry a forged/
      // malformed delivery, but change nothing.
      return res.status(200).json({ received: true, verified: false });
    }

    const orderRef = provider === 'jazzcash' ? req.body.pp_TxnRefNo : req.body.orderId;
    const transaction = await PaymentGatewayTransaction.findOne({ orderRef, provider });
    if (!transaction) {
      return res.status(200).json({ received: true, verified: true, matched: false });
    }

    transaction.status = verification.success ? 'completed' : 'failed';
    transaction.responseCode = verification.responseCode || transaction.responseCode;
    transaction.responseMessage = verification.responseMessage || transaction.responseMessage;
    transaction.rawResponse = req.body;
    if (verification.providerTransactionId) transaction.providerTransactionId = verification.providerTransactionId;
    await transaction.save();

    res.status(200).json({ received: true, verified: true, status: transaction.status });
  } catch (err) {
    // A 200 here too — a 4xx/5xx on a webhook endpoint typically triggers
    // provider-side retries of the SAME payload, which won't succeed any
    // differently on retry for a bug on our end; logging is what actually
    // matters for follow-up.
    console.error(`Payment gateway callback (${req.params.provider}) failed:`, err.message);
    res.status(200).json({ received: true, verified: false });
  }
}

async function getStatus(req, res) {
  const transaction = await PaymentGatewayTransaction.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
  res.json({
    transactionId: transaction._id,
    status: transaction.status,
    provider: transaction.provider,
    amount: transaction.amount,
    responseMessage: transaction.responseMessage,
  });
}

module.exports = { initiate, callback, getStatus };
