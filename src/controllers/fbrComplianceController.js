/**
 * FbrComplianceController — backs the "FBR Compliance" dashboard
 * (client/src/pages/FbrCompliancePage.jsx): submission success/failure
 * counts for a date range, the list of sales still pending/failed, a
 * retry-all action, and the company's current NTN/STRN/token status.
 */
const Sale = require('../models/Sale');
const Company = require('../models/Company');
const fbrService = require('../services/fbrService');

function endOfDay(dateStr) {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function dateRangeFilter(companyId, query) {
  const filter = { companyId, status: 'completed' };
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = endOfDay(query.to);
  }
  return filter;
}

async function summary(req, res) {
  try {
    const filter = dateRangeFilter(req.companyId, req.query);

    const [total, submitted, failed] = await Promise.all([
      Sale.countDocuments(filter),
      Sale.countDocuments({ ...filter, fbrSubmittedAt: { $ne: null } }),
      Sale.countDocuments({ ...filter, fbrSubmittedAt: null, fbrSubmissionError: { $ne: null } }),
    ]);
    const pending = total - submitted - failed;

    const company = await Company.findById(req.companyId).select('ntn strn fbrPosId fbrApiToken fbrSandboxMode');
    res.json({
      counts: { total, submitted, failed, pending },
      credentials: {
        ntnConfigured: Boolean(company?.ntn),
        strnConfigured: Boolean(company?.strn),
        fbrPosIdConfigured: Boolean(company?.fbrPosId),
        fbrApiTokenConfigured: Boolean(company?.fbrApiToken),
        sandboxMode: company?.fbrSandboxMode ?? true,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** Completed sales still unresolved with FBR (never submitted, or the last attempt failed). */
async function listOutstanding(req, res) {
  try {
    const filter = dateRangeFilter(req.companyId, req.query);
    const sales = await Sale.find({ ...filter, fbrSubmittedAt: null })
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 200)
      .select('invoiceNumber documentNumber totalAmount createdAt fbrSubmissionError fbrLastAttemptAt')
      .populate('customerId', 'name');
    res.json(sales);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** Retries every currently-outstanding sale for this company, tolerating per-sale failures. */
async function retryAll(req, res) {
  try {
    const filter = dateRangeFilter(req.companyId, req.query);
    const sales = await Sale.find({ ...filter, fbrSubmittedAt: null }).select('_id invoiceNumber');

    let succeeded = 0;
    const failures = [];
    for (const sale of sales) {
      try {
        await fbrService.submitInvoice(sale._id);
        succeeded++;
      } catch (err) {
        failures.push({ saleId: sale._id, invoiceNumber: sale.invoiceNumber, error: err.message });
      }
    }
    res.json({ attempted: sales.length, succeeded, failed: failures.length, failures });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { summary, listOutstanding, retryAll };
