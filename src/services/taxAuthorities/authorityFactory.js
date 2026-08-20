/**
 * Factory for the four provincial services-tax authorities (SRB, PRA,
 * KPRA, BRA) — avoids four near-identical copy-pasted files.
 *
 * ============================================================================
 * IMPORTANT — READ BEFORE USING IN PRODUCTION
 * ============================================================================
 * Unlike FBR (which has a documented public Digital Invoicing API — see
 * fbrService.js), the provincial revenue authorities do NOT have a single,
 * uniformly documented, publicly known real-time e-invoicing API. Each
 * province's system differs: some are portal-only with no API at all, some
 * require SOAP/XML rather than JSON, and endpoint URLs/payload field names
 * are only available from each authority's own developer documentation,
 * which is generally handed out AFTER a business completes tax
 * registration with that authority — it is not public.
 *
 * Practically, this means:
 *  - `defaultBaseUrl` values passed into createAuthorityService() below are
 *    UNVERIFIED PLACEHOLDERS, not confirmed real endpoints. Do not treat
 *    them as correct. Always override via the *_API_BASE_URL env var with
 *    the actual URL from your authority's registration documentation.
 *  - `buildInvoicePayload`'s field names (sellerSTRN, invoiceNumber, etc.)
 *    are a reasonable generic guess, not a verified schema. They WILL need
 *    to be adjusted per-authority once you have real API docs.
 *  - Submitting unverified payloads to a live government endpoint could
 *    silently fail, be rejected, or — worse — appear to succeed while not
 *    actually satisfying the legal filing requirement. This is a
 *    legal/compliance matter, not something safe to guess at.
 *
 * Use TAX_AUTHORITY_DRY_RUN=true (see below) to review the exact payload
 * this code would send, without ever making a network call, so your (or
 * the client's) compliance team can compare it against the authority's
 * real documented schema before switching dry-run off.
 *
 * See ./README.md for the full picture across all five authorities.
 * ============================================================================
 */
const Sale = require('../../models/Sale');
const Company = require('../../models/Company');

function createAuthorityService({ name, baseUrlEnvVar, defaultBaseUrl, tokenEnvVar }) {
  const authorityKey = name.toLowerCase();
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

  /** Fails fast with a clear message rather than letting a malformed request reach the authority. */
  function validate(sale, company) {
    const errors = [];
    if (!company) errors.push('Company not found.');
    if (company && !company.strn) errors.push(`Company STRN is required before submitting to ${name} (services-sector sales tax registration).`);
    if (company && !company.ntn) errors.push(`Company NTN is required before submitting to ${name}.`);
    if (!sale.invoiceNumber) errors.push('Sale has no invoiceNumber yet.');
    if (!sale.items || sale.items.length === 0) errors.push('Sale has no items.');
    if (errors.length) throw new Error(`${name} submission validation failed: ${errors.join(' ')}`);
  }

  async function submitInvoice(saleId) {
    const sale = await Sale.findById(saleId);
    if (!sale) throw new Error('Sale not found.');

    const existing = sale.taxSubmissions.find((s) => s.authority === authorityKey);
    if (existing) return { referenceNumber: existing.referenceNumber };

    const company = await Company.findById(sale.companyId);
    validate(sale, company);

    const payload = buildInvoicePayload(sale, company);

    // Dry-run mode: log the payload instead of POSTing. Intended for a
    // company's own compliance team to review this payload shape against
    // their authority's actual registered API docs before going live —
    // set TAX_AUTHORITY_DRY_RUN=true in any non-production environment.
    if (process.env.TAX_AUTHORITY_DRY_RUN === 'true') {
      console.log(`[${name} dry-run] would POST to ${baseUrl}/invoices (UNVERIFIED placeholder URL/shape — confirm against ${name}'s real API docs):`, JSON.stringify(payload, null, 2));
      return { referenceNumber: `DRYRUN-${sale.invoiceNumber}` };
    }

    if (!token) throw new Error(`${tokenEnvVar} is not configured.`);

    const response = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`${name} submission failed (${response.status}): ${await response.text().catch(() => '')}`);

    const data = await response.json();
    const referenceNumber = data.referenceNumber || data.invoiceNumber;

    sale.taxSubmissions.push({ authority: authorityKey, referenceNumber, submittedAt: new Date() });
    await sale.save();

    return { referenceNumber };
  }

  return { submitInvoice, buildInvoicePayload, validate };
}

module.exports = { createAuthorityService };
