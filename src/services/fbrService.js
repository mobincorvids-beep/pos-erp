/**
 * FbrService — submits completed sales to FBR's Digital Invoicing API.
 *
 * Deliberately NOT called inside PosSaleService's transaction: it's an
 * external network call, and a checkout must never roll back (or block on
 * network latency) because a government API is slow or briefly down. Call
 * submitInvoice() as a side effect after checkout succeeds, or from a retry
 * queue/cron for sales where fbrSubmittedAt is still null.
 *
 * This is a stub against FBR's real endpoint shape — align the payload
 * mapping to the actual PRAL/FBR Digital Invoicing spec your company is
 * registered under (rules differ slightly for SRB/PRA/KPRA/BRA).
 *
 * There is no platform-wide FBR account: this app is multi-tenant, and
 * every vendor (Company) registers their OWN NTN/STRN with FBR and gets
 * their own Bearer token from FBR's IRIS portal. So the token is read per
 * company (company.fbrApiToken), entered by the vendor themselves under
 * Settings, not from a shared process.env value. FBR's sandbox and
 * production Digital Invoicing environments are both served from the same
 * host (gw.fbr.gov.pk/di_data/v1/di) per FBR's own integration
 * documentation — sandbox vs production is a property of which TOKEN you
 * were issued, not a different URL, so company.fbrSandboxMode is tracked
 * only to surface the right guidance in errors/UI, not to pick a host.
 */
const Sale = require('../models/Sale');
const Company = require('../models/Company');

const FBR_BASE_URL = 'https://gw.fbr.gov.pk/di_data/v1/di';

function buildInvoicePayload(sale, company) {
  return {
    invoiceType: 'Sale Invoice',
    invoiceDate: sale.createdAt,
    sellerNTNCNIC: company.ntn,
    sellerSTRN: company.strn,
    sellerAddress: company.address,
    invoiceNumber: sale.invoiceNumber,
    totalAmount: sale.totalAmount,
    salesTax: sale.taxAmount,
    items: sale.items.map((item) => ({
      hsCode: null, // map from your product catalog once HS codes are captured per product
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      totalValue: item.lineTotal,
    })),
  };
}

/**
 * @param {String} saleId
 * @returns {Promise<{ fbrInvoiceNumber: string, fbrQrCode: string }>}
 */
async function submitInvoice(saleId) {
  const sale = await Sale.findById(saleId);
  if (!sale) throw new Error('Sale not found.');
  if (sale.fbrSubmittedAt) return { fbrInvoiceNumber: sale.fbrInvoiceNumber, fbrQrCode: sale.fbrQrCode };

  const company = await Company.findById(sale.companyId);
  if (!company?.fbrPosId) throw new Error('Company is not registered with an FBR POS ID.');
  if (!company?.fbrApiToken) {
    throw new Error('FBR API token is not configured for this company. Add it under Settings > Business details.');
  }

  const payload = buildInvoicePayload(sale, company);

  const response = await fetch(`${FBR_BASE_URL}/postinvoicedata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${company.fbrApiToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`FBR submission failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  // Field names below are illustrative — align to FBR's actual response schema.
  const fbrInvoiceNumber = data.invoiceNumber || data.fbrInvoiceNumber;
  const fbrQrCode = data.qrCode || data.fbrQrCode;

  sale.fbrInvoiceNumber = fbrInvoiceNumber;
  sale.fbrQrCode = fbrQrCode;
  sale.fbrSubmittedAt = new Date();
  await sale.save();

  return { fbrInvoiceNumber, fbrQrCode };
}

/** Finds completed sales never submitted to FBR, feed this to a retry cron. */
async function findUnsubmittedSales(companyId, limit = 50) {
  return Sale.find({
    companyId,
    status: 'completed',
    fbrSubmittedAt: null,
  }).limit(limit);
}

module.exports = { submitInvoice, findUnsubmittedSales, buildInvoicePayload };
