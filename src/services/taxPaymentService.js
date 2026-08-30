/**
 * TaxPaymentService — lets a vendor pay their OWN tax liability to FBR (or
 * another authority) online via their own JazzCash tax-pay credentials.
 * Distinct from taxComplianceService/fbrService, which submit sales
 * invoices for e-invoicing/reporting, not payment.
 */
const Company = require('../models/Company');
const Role = require('../models/Role');
const TaxPayment = require('../models/TaxPayment');
const jazzCashTaxPayService = require('./paymentGateways/jazzCashTaxPayService');
const notificationService = require('./notificationService');

/**
 * Notifies every role that can see/pay tax payments that a return/liability
 * is sitting there waiting, so a vendor's accountant or owner actually
 * finds out instead of having to remember to check the Tax Payments tab.
 * Best-effort: a notification failure must never block the tax payment
 * record itself from existing — same principle as inventoryService's
 * low-stock alerts and documentService's expiry alerts.
 */
async function notifyRoles(taxPayment, { type, title, message }) {
  try {
    const roles = await Role.find({
      companyId: taxPayment.companyId,
      permissions: { $in: ['tax_payments.view', 'tax_payments.pay', '*'] },
    });
    for (const role of roles) {
      await notificationService.notify({
        companyId: taxPayment.companyId, roleId: role._id, type, title, message,
        entityType: 'TaxPayment', entityId: taxPayment._id,
      });
    }
  } catch (err) {
    console.error(`taxPaymentService.notifyRoles(${type}) failed:`, err.message);
  }
}

function notifyReturnDue(taxPayment) {
  return notifyRoles(taxPayment, {
    type: 'tax_return_due',
    title: `${taxPayment.taxAuthority.toUpperCase()} return due: ${taxPayment.periodLabel}`,
    message: `A tax liability of ${taxPayment.amountDue} for ${taxPayment.periodLabel} is ready to pay. Go to Settings → Tax Payments to pay it directly to FBR via JazzCash.`,
  });
}

function notifyPaymentOutcome(taxPayment) {
  const paid = taxPayment.status === 'paid';
  return notifyRoles(taxPayment, {
    type: paid ? 'tax_payment_succeeded' : 'tax_payment_failed',
    title: paid
      ? `${taxPayment.taxAuthority.toUpperCase()} return paid: ${taxPayment.periodLabel}`
      : `${taxPayment.taxAuthority.toUpperCase()} payment failed: ${taxPayment.periodLabel}`,
    message: paid
      ? `${taxPayment.amountPaid} was sent directly to FBR account ${taxPayment.fbrAccountNumber || ''} via JazzCash.`
      : (taxPayment.failureReason || 'The JazzCash tax payment did not go through, please retry.'),
  });
}

async function createTaxPayment({ companyId, taxAuthority, periodLabel, amountDue, userId }) {
  const taxPayment = await TaxPayment.create({
    companyId,
    taxAuthority: taxAuthority || 'fbr',
    periodLabel,
    amountDue,
    status: 'pending',
    initiatedBy: userId || null,
  });
  // Fire-and-forget, same pattern taxComplianceService/inventoryService use
  // for post-commit side effects — a slow/failed notification must never
  // block the tax liability from being recorded.
  notifyReturnDue(taxPayment);
  return taxPayment;
}

/** Loads the TaxPayment + the company's jazzCashTaxPay config, calls out to JazzCash, and updates status accordingly. */
async function initiatePayment(taxPaymentId, companyId) {
  const taxPayment = await TaxPayment.findOne({ _id: taxPaymentId, companyId });
  if (!taxPayment) throw new Error('Tax payment not found.');
  if (taxPayment.status === 'paid') throw new Error('This tax payment has already been paid.');

  const company = await Company.findById(companyId);
  const config = company?.jazzCashTaxPay;
  if (!config?.enabled) {
    throw new Error('JazzCash tax-pay is not enabled for this company, configure it under Settings.');
  }
  if (!config.fbrAccountNumber && !taxPayment.fbrAccountNumber) {
    throw new Error('No FBR account number configured to pay into.');
  }

  const fbrAccountNumber = config.fbrAccountNumber;
  const billReference = `TAXPAY-${taxPayment._id}`;

  let result;
  try {
    result = await jazzCashTaxPayService.initiateTaxPayment({
      config,
      amount: taxPayment.amountDue,
      fbrAccountNumber,
      billReference,
    });
  } catch (err) {
    taxPayment.status = 'failed';
    taxPayment.failureReason = err.message;
    await taxPayment.save();
    throw err;
  }

  taxPayment.provider = 'jazzcash';
  taxPayment.providerTransactionId = result.providerTransactionId || billReference;
  taxPayment.fbrAccountNumber = fbrAccountNumber;
  taxPayment.initiatedAt = new Date();
  // A synchronous decline maps straight to failed; anything not an
  // immediate success stays 'initiated' pending JazzCash's callback,
  // same as paymentGatewayController's handling of MWALLET responses.
  if (result.success) {
    taxPayment.status = 'paid';
    taxPayment.amountPaid = taxPayment.amountDue;
    taxPayment.paidAt = new Date();
  } else if (result.responseCode) {
    taxPayment.status = 'failed';
    taxPayment.failureReason = result.responseMessage || `JazzCash declined (${result.responseCode}).`;
  } else {
    taxPayment.status = 'initiated';
  }
  await taxPayment.save();
  // Only notify here on a synchronous, final outcome (paid or failed) —
  // an 'initiated' status is still pending JazzCash's callback, which
  // notifies on its own once the real outcome is known (see handleCallback).
  if (taxPayment.status === 'paid' || taxPayment.status === 'failed') {
    notifyPaymentOutcome(taxPayment);
  }

  return { taxPayment, result };
}

/** Handles JazzCash's inbound tax-pay callback. Company is looked up from the TaxPayment's own companyId, never trusted from the payload. */
async function handleCallback(payload) {
  const txnRefNo = payload.pp_TxnRefNo || '';
  const match = /^TAXPAY-([a-f0-9]{24})$/i.exec(txnRefNo);
  if (!match) return { matched: false, verified: false };

  const taxPayment = await TaxPayment.findById(match[1]);
  if (!taxPayment) return { matched: false, verified: false };

  const company = await Company.findById(taxPayment.companyId);
  const config = company?.jazzCashTaxPay;
  if (!config?.enabled) return { matched: true, verified: false };

  const verification = jazzCashTaxPayService.verifyTaxPaymentCallback({ config, payload });
  if (!verification.valid) return { matched: true, verified: false };

  if (verification.success) {
    taxPayment.status = 'paid';
    taxPayment.amountPaid = taxPayment.amountDue;
    taxPayment.paidAt = new Date();
  } else {
    taxPayment.status = 'failed';
    taxPayment.failureReason = verification.responseMessage || 'Payment declined.';
  }
  if (verification.providerTransactionId) taxPayment.providerTransactionId = verification.providerTransactionId;
  await taxPayment.save();
  notifyPaymentOutcome(taxPayment);

  return { matched: true, verified: true, status: taxPayment.status };
}

async function listForCompany(companyId, filters = {}) {
  const query = { companyId };
  if (filters.status) query.status = filters.status;
  if (filters.taxAuthority) query.taxAuthority = filters.taxAuthority;
  return TaxPayment.find(query).sort({ createdAt: -1 });
}

async function getById(id, companyId) {
  return TaxPayment.findOne({ _id: id, companyId });
}

module.exports = { createTaxPayment, initiatePayment, handleCallback, listForCompany, getById };
