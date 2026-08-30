/**
 * Controller for vendor-initiated tax payments (paying FBR/etc their own
 * tax liability via their own JazzCash tax-pay credentials). `jazzCashCallback`
 * is deliberately PUBLIC — hit directly by JazzCash's servers, no bearer
 * token available to them — mirroring paymentGatewayController.callback.
 */
const taxPaymentService = require('../services/taxPaymentService');

async function create(req, res) {
  try {
    const { taxAuthority, periodLabel, amountDue } = req.body;
    const taxPayment = await taxPaymentService.createTaxPayment({
      companyId: req.companyId,
      taxAuthority,
      periodLabel,
      amountDue,
      userId: req.auth.userId,
    });
    res.status(201).json(taxPayment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function pay(req, res) {
  try {
    const { taxPayment, result } = await taxPaymentService.initiatePayment(req.params.id, req.companyId);
    res.json({
      taxPayment,
      responseCode: result.responseCode,
      responseMessage: result.responseMessage,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** PUBLIC — hit by JazzCash's own servers. No requireAuth/scopeToCompany in front; the TaxPayment's own companyId (via the pp_TxnRefNo billReference) is the only tenant scoping, verified through the company's own stored signature secret before anything is trusted. */
async function jazzCashCallback(req, res) {
  try {
    const result = await taxPaymentService.handleCallback(req.body);
    // Always 200 so JazzCash doesn't endlessly retry a delivery we can't
    // act on differently — same reasoning as paymentGatewayController.callback.
    res.status(200).json({ received: true, ...result });
  } catch (err) {
    console.error('JazzCash tax-pay callback failed:', err.message);
    res.status(200).json({ received: true, verified: false });
  }
}

async function list(req, res) {
  try {
    const { status, taxAuthority } = req.query;
    const rows = await taxPaymentService.listForCompany(req.companyId, { status, taxAuthority });
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getOne(req, res) {
  const taxPayment = await taxPaymentService.getById(req.params.id, req.companyId);
  if (!taxPayment) return res.status(404).json({ error: 'Tax payment not found.' });
  res.json(taxPayment);
}

module.exports = { create, pay, jazzCashCallback, list, getOne };
