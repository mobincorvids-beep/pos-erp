/**
 * Factory for the provincial services-tax authorities that share SRB's
 * shape (PRA, KPRA, BRA) — avoids three near-identical copy-pasted files.
 * If one of these authorities' real API diverges structurally, promote it
 * to its own file (like srbService.js) instead of forcing it through here.
 */
const Sale = require('../../models/Sale');
const Company = require('../../models/Company');

function createAuthorityService({ name, baseUrlEnvVar, defaultBaseUrl, tokenEnvVar }) {
  const baseUrl = process.env[baseUrlEnvVar] || defaultBaseUrl;
  const token = process.env[tokenEnvVar];

  function buildInvoicePayload(sale, company) {
    return {
      authority: name,
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
    if (!token) throw new Error(`${tokenEnvVar} is not configured.`);

    const sale = await Sale.findById(saleId);
    if (!sale) throw new Error('Sale not found.');

    const existing = sale.taxSubmissions.find((s) => s.authority === name.toLowerCase());
    if (existing) return { referenceNumber: existing.referenceNumber };

    const company = await Company.findById(sale.companyId);
    const payload = buildInvoicePayload(sale, company);

    const response = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`${name} submission failed (${response.status}): ${await response.text().catch(() => '')}`);

    const data = await response.json();
    const referenceNumber = data.referenceNumber || data.invoiceNumber;

    sale.taxSubmissions.push({ authority: name.toLowerCase(), referenceNumber, submittedAt: new Date() });
    await sale.save();

    return { referenceNumber };
  }

  return { submitInvoice, buildInvoicePayload };
}

module.exports = { createAuthorityService };
