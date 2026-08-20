const Sale = require('../models/Sale');
const posSaleService = require('../services/posSaleService');
const fbrService = require('../services/fbrService');
const taxComplianceService = require('../services/taxComplianceService');
const loyaltyService = require('../services/loyaltyService');
const saleReturnService = require('../services/saleReturnService');

async function list(req, res) {
  const filter = { companyId: req.companyId, saleType: 'pos', status: { $ne: 'quotation' } };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
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
    const sale = await posSaleService.checkout({
      ...req.body,
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

/**
 * Admin/reconciliation action: retries tax-compliance submission for every
 * completed sale of this company still missing a submission to at least
 * one registered authority (FBR and/or SRB/PRA/KPRA/BRA). Company-scoped
 * via req.companyId like every other route on this router.
 */
async function retryTaxCompliance(req, res) {
  try {
    const results = await taxComplianceService.retryPendingCompliance(req.companyId, Number(req.query.limit) || 100);
    res.json({ retried: results.length, results });
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

module.exports = { list, get, checkout, submitFbr, submitTaxCompliance, retryTaxCompliance, processReturn, voidSale };
