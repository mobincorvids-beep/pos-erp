/**
 * TaxComplianceService — the single entry point for "submit this sale to
 * whichever tax authorities the company is registered with." Callers
 * (saleController) don't need to know FBR is federal and SRB/PRA/KPRA/BRA
 * are provincial, or that a company might be registered with more than
 * one — they call submitForCompliance(saleId) and this fans out to each
 * authority in Company.taxAuthorities, tolerating individual failures so
 * one authority being down doesn't block submission to the others.
 */
const Company = require('../models/Company');
const Sale = require('../models/Sale');
const fbrService = require('./fbrService');
const srbService = require('./taxAuthorities/srbService');
const praService = require('./taxAuthorities/praService');
const kpraService = require('./taxAuthorities/kpraService');
const braService = require('./taxAuthorities/braService');

const REGISTRY = { fbr: fbrService, srb: srbService, pra: praService, kpra: kpraService, bra: braService };

/**
 * @param {String} saleId
 * @returns {Promise<Array<{ authority: string, success: boolean, referenceNumber?: string, error?: string }>>}
 */
async function submitForCompliance(saleId) {
  const sale = await Sale.findById(saleId);
  if (!sale) throw new Error('Sale not found.');

  const company = await Company.findById(sale.companyId);
  const authorities = company?.taxAuthorities || [];
  if (authorities.length === 0) return [];

  const results = [];
  for (const authority of authorities) {
    const service = REGISTRY[authority];
    if (!service) {
      results.push({ authority, success: false, error: `No integration registered for "${authority}".` });
      continue;
    }
    try {
      const result = await service.submitInvoice(saleId);
      results.push({ authority, success: true, referenceNumber: result.referenceNumber || result.fbrInvoiceNumber });
    } catch (err) {
      // Deliberately caught per-authority, not re-thrown — one authority's
      // API being down or misconfigured must not stop submission to the
      // others, and must never surface as a checkout failure (see
      // saleController: this always runs as a post-commit side effect).
      results.push({ authority, success: false, error: err.message });
    }
  }
  return results;
}

/** Which authorities on this sale still need submitting (registered but not yet submitted or failed last time). */
async function pendingAuthorities(saleId) {
  const sale = await Sale.findById(saleId);
  if (!sale) throw new Error('Sale not found.');

  const company = await Company.findById(sale.companyId);
  const registered = company?.taxAuthorities || [];

  const submitted = new Set(sale.taxSubmissions.map((s) => s.authority));
  if (sale.fbrSubmittedAt) submitted.add('fbr');

  return registered.filter((a) => !submitted.has(a));
}

/**
 * Finds completed sales for a company that are missing a submission to at
 * least one authority the company is registered with (FBR and/or any of
 * SRB/PRA/KPRA/BRA). Feed this to a cron or an admin "retry failed
 * submissions" action — see reportController.retryTaxCompliance.
 */
async function findPendingComplianceSales(companyId, limit = 100) {
  const company = await Company.findById(companyId);
  const registered = company?.taxAuthorities || [];
  if (registered.length === 0) return [];

  const sales = await Sale.find({ companyId, status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit);

  return sales.filter((sale) => {
    const submitted = new Set(sale.taxSubmissions.map((s) => s.authority));
    if (sale.fbrSubmittedAt) submitted.add('fbr');
    return registered.some((a) => !submitted.has(a));
  });
}

/**
 * Retries compliance submission for every completed sale of a company that
 * still has a pending authority. Tolerates per-sale failures the same way
 * submitForCompliance tolerates per-authority failures.
 */
async function retryPendingCompliance(companyId, limit = 100) {
  const sales = await findPendingComplianceSales(companyId, limit);
  const results = [];
  for (const sale of sales) {
    const authorityResults = await submitForCompliance(sale._id);
    results.push({ saleId: sale._id, invoiceNumber: sale.invoiceNumber, authorityResults });
  }
  return results;
}

module.exports = {
  submitForCompliance,
  pendingAuthorities,
  findPendingComplianceSales,
  retryPendingCompliance,
  REGISTRY,
};
