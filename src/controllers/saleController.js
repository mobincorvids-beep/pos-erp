const Sale = require('../models/Sale');
const posSaleService = require('../services/posSaleService');
const fbrService = require('../services/fbrService');
const taxComplianceService = require('../services/taxComplianceService');
const loyaltyService = require('../services/loyaltyService');
const saleReturnService = require('../services/saleReturnService');

// `to` arrives as a plain "YYYY-MM-DD" string — new Date(to) alone parses
// that as midnight UTC (the START of that day), so a `$lte` bound against
// it would silently exclude every sale made later that same day for any
// caller in a timezone ahead of UTC. Push it to the last instant of that
// calendar date instead — see reportingService.js's endOfDay for the same
// fix applied to every report.
function endOfDay(dateStr) {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

async function list(req, res) {
  const filter = { companyId: req.companyId, saleType: 'pos', status: { $ne: 'quotation' } };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = endOfDay(req.query.to);
  }
  const sales = await Sale.find(filter).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 100).populate('customerId', 'name');
  res.json(sales);
}

async function get(req, res) {
  const sale = await Sale.findOne({ _id: req.params.id, companyId: req.companyId }).populate('customerId', 'name');
  if (!sale) return res.status(404).json({ error: 'Sale not found.' });
  res.json(sale);
}

async function checkout(req, res) {
  try {
    // overrideCreditLimit only takes effect when the requester actually
    // carries the override permission — a client passing the flag on its
    // own is never enough, the same "trust the server-side check, not the
    // request body" rule the rest of checkout already follows for totals.
    const { hasPermission } = require('../middleware/auth');
    const { CUSTOMER_CREDIT_LIMIT_OVERRIDE } = require('../constants/permissions');
    const overrideCreditLimit = Boolean(req.body.overrideCreditLimit) && hasPermission(req, CUSTOMER_CREDIT_LIMIT_OVERRIDE);

    const sale = await posSaleService.checkout({
      ...req.body,
      overrideCreditLimit,
      companyId: req.companyId,
      userId: req.auth.userId,
    });

    // Tax authority submission is a post-commit side effect — the sale is
    // already final at this point, so a slow/down government API must
    // never block or fail the checkout response. Dispatches to every
    // authority the company is actually registered with (Company.taxAuthorities);
    // failures are caught per-authority inside the service and just logged here.
    taxComplianceService.submitForCompliance(sale._id).catch((err) => {
      console.error(`Tax compliance submission failed for sale ${sale.invoiceNumber}:`, err.message);
    });

    // Loyalty points are earned after the sale is final too — a missing/
    // misconfigured loyalty program should never block a checkout.
    loyaltyService.earnPointsForSale(sale).catch((err) => {
      console.error(`Loyalty earn failed for sale ${sale.invoiceNumber}:`, err.message);
    });

    res.status(201).json(sale);
  } catch (err) {
    // CREDIT_LIMIT_EXCEEDED is a soft-block, not a validation failure —
    // surfaced with its own code + details so the frontend can show a
    // specific "over credit limit" warning (with an Override button, for
    // whoever has the permission) rather than a generic error toast.
    if (err.code === 'CREDIT_LIMIT_EXCEEDED') {
      return res.status(409).json({ error: err.message, code: err.code, details: err.details });
    }
    res.status(400).json({ error: err.message });
  }
}

/** Manual retry for a sale that failed FBR submission, or wasn't submitted automatically. */
async function submitFbr(req, res) {
  try {
    const result = await fbrService.submitInvoice(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** Manual retry across every tax authority the company is registered with, not just FBR. */
async function submitTaxCompliance(req, res) {
  try {
    const results = await taxComplianceService.submitForCompliance(req.params.id);
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function processReturn(req, res) {
  try {
    const saleReturn = await saleReturnService.processReturn(req.params.id, { ...req.body, userId: req.auth.userId });
    res.status(201).json(saleReturn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function voidSale(req, res) {
  try {
    const sale = await saleReturnService.voidSale(req.params.id, { userId: req.auth.userId, reason: req.body.reason });
    res.json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * Confirms a cash-on-delivery sale's cash was actually collected by the
 * driver/cashier at the point of delivery. Deliberately simple (no ledger
 * posting here) — a COD sale is already posted as paid/due at checkout
 * time via its own `payments`/`dueAmount` the normal way; this only
 * flips the delivery-confirmation flag distributors/wholesalers need to
 * know a shipment's cash is actually back in hand, not still on the road.
 */
async function markCodCollected(req, res) {
  const sale = await Sale.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!sale) return res.status(404).json({ error: 'Sale not found.' });
  if (!sale.isCOD) return res.status(400).json({ error: 'This sale is not marked as cash-on-delivery.' });
  if (sale.codCollectedAt) return res.status(400).json({ error: 'COD has already been marked collected for this sale.' });

  sale.codCollectedAt = new Date();
  sale.codCollectedBy = req.auth.userId;
  await sale.save();
  res.json(sale);
}

module.exports = { list, get, checkout, submitFbr, submitTaxCompliance, processReturn, voidSale, markCodCollected };
