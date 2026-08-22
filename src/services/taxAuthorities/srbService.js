/**
 * SrbService — Sindh Revenue Board sales-tax-on-services e-invoicing stub.
 * Same shape as FbrService: buildInvoicePayload + submitInvoice, swap in
 * SRB's real endpoint/payload once you have API docs and credentials.
 */
const Sale = require('../../models/Sale');
const Company = require('../../models/Company');

const SRB_BASE_URL = process.env.SRB_API_BASE_URL || 'https://e.srb.gos.pk/api';
const SRB_TOKEN = process.env.SRB_API_TOKEN;

function buildInvoicePayload(sale, company) {
  return {
    sellerSTRN: company.strn,
    sellerNTN: company.ntn,
    invoiceNumber: sale.invoiceNumber,
    invoiceDate: sale.createdAt,
    totalAmount: sale.totalAmount,
    salesTax: sale.taxAmount,
    items: sale.items.map((item) => ({
      quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate, taxAmount: item.taxAmount,
    })),
  };
}

async function submitInvoice(saleId) {
  if (!SRB_TOKEN) throw new Error('SRB_API_TOKEN is not configured.');

  const sale = await Sale.findById(saleId);
  if (!sale) throw new Error('Sale not found.');

  const existing = sale.taxSubmissions.find((s) => s.authority === 'srb');
  if (existing) return { referenceNumber: existing.referenceNumber };

  const company = await Company.findById(sale.companyId);
  const payload = buildInvoicePayload(sale, company);

  const response = await fetch(`${SRB_BASE_URL}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SRB_TOKEN}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`SRB submission failed (${response.status}): ${await response.text().catch(() => '')}`);

  const data = await response.json();
  const referenceNumber = data.referenceNumber || data.invoiceNumber;

  sale.taxSubmissions.push({ authority: 'srb', referenceNumber, submittedAt: new Date() });
  await sale.save();

  return { referenceNumber };
}

module.exports = { submitInvoice, buildInvoicePayload };
