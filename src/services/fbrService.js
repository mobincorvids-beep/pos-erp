/**
 * FbrService — submits completed sales to FBR's Digital Invoicing API.
 *
 * Deliberately NOT called inside PosSaleService's transaction: it's an
 * external network call, and a checkout must never roll back (or block on
 * network latency) because a government API is slow or briefly down. Call
 * submitInvoice() as a side effect after checkout succeeds, or from a retry
 * queue/cron for sales where fbrSubmittedAt is still null.
 *
 * This is a stub against FBR's real endpoint shape — swap FBR_BASE_URL and
 * the payload mapping for the actual PRAL/FBR Digital Invoicing spec your
 * company is registered under (rules differ slightly for SRB/PRA/KPRA/BRA).
 */
const Sale = require('../models/Sale');
const Company = require('../models/Company');

const FBR_BASE_URL = process.env.FBR_API_BASE_URL || 'https://gw.fbr.gov.pk/di_data/v1/di';
const FBR_TOKEN = process.env.FBR_API_TOKEN;

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
  if (!FBR_TOKEN) {
    throw new Error('FBR_API_TOKEN is not configured — set it in .env before submitting invoices.');
  }

  const sale = await Sale.findById(saleId);
  if (!sale) throw new Error('Sale not found.');
  if (sale.fbrSubmittedAt) return { fbrInvoiceNumber: sale.fbrInvoiceNumber, fbrQrCode: sale.fbrQrCode };

  const company = await Company.findById(sale.companyId);
  if (!company?.fbrPosId) throw new Error('Company is not registered with an FBR POS ID.');

  const payload = buildInvoicePayload(sale, company);

  const response = await fetch(`${FBR_BASE_URL}/postinvoicedata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${FBR_TOKEN}`,
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

/** Finds completed sales never submitted to FBR — feed this to a retry cron. */
async function findUnsubmittedSales(companyId, limit = 50) {
  return Sale.find({
    companyId,
    status: 'completed',
    fbrSubmittedAt: null,
  }).limit(limit);
}

module.exports = { submitInvoice, findUnsubmittedSales, buildInvoicePayload };
