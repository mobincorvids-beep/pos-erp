/**
 * FbrService — submits completed sales to FBR's Digital Invoicing API
 * (the PRAL-operated "postinvoicedata" gateway).
 *
 * Deliberately NOT called inside PosSaleService's transaction: it's an
 * external network call, and a checkout must never roll back (or block on
 * network latency) because a government API is slow or briefly down. Call
 * submitInvoice() as a side effect after checkout succeeds, or from a retry
 * queue/cron for sales where fbrSubmittedAt is still null.
 *
 * Accuracy note: the payload below follows FBR's publicly documented
 * Digital Invoicing field set (invoiceType, sellerNTNCNIC, buyer*, items[]
 * with hsCode/uoM/valueSalesExcludingST/salesTaxApplicable/etc.). It has
 * NOT been validated against a live FBR account by this codebase — before
 * going live, register for FBR's sandbox, obtain a bearer token, and post
 * real invoices there (FBR_ENV=sandbox, the default) to confirm every
 * field name/value FBR actually expects for your seller category and
 * scenario. Only switch FBR_ENV to "production" once sandbox responses
 * are clean. See src/services/taxAuthorities/README.md for the full
 * picture across all five tax authorities.
 */
const Sale = require('../models/Sale');
const Company = require('../models/Company');

const FBR_ENV = (process.env.FBR_ENV || 'sandbox').toLowerCase();

// FBR publishes separate sandbox/production gateways with different
// postinvoicedata suffixes ("postinvoicedata_sb" for sandbox). Sandbox
// must be used for integration testing — never point untested code at
// production.
const FBR_SANDBOX_BASE_URL = process.env.FBR_SANDBOX_API_BASE_URL || 'https://gw.fbr.gov.pk/di_data/v1/di';
const FBR_PRODUCTION_BASE_URL = process.env.FBR_PRODUCTION_API_BASE_URL || 'https://gw.fbr.gov.pk/di_data/v1/di';
const FBR_BASE_URL = process.env.FBR_API_BASE_URL
  || (FBR_ENV === 'production' ? FBR_PRODUCTION_BASE_URL : FBR_SANDBOX_BASE_URL);
const FBR_INVOICE_PATH = FBR_ENV === 'production' ? 'postinvoicedata' : 'postinvoicedata_sb';

const FBR_TOKEN = process.env.FBR_API_TOKEN;

/**
 * Builds the invoice payload for FBR's Digital Invoicing POS integration.
 * Field names/shape mirror FBR's publicly documented schema; values are
 * mapped from Sale/Company where those fields exist. Fields FBR requires
 * but this codebase has no source data for yet are left as documented
 * placeholders (null/defaults) rather than guessed — fill them in once
 * the corresponding data (HS codes, buyer registration, scenario IDs,
 * province) is actually captured in the product/sale/company models.
 */
function buildInvoicePayload(sale, company) {
  return {
    invoiceType: 'Sale Invoice',
    invoiceDate: (sale.createdAt || new Date()).toISOString().slice(0, 10),

    sellerNTNCNIC: company.ntn,
    sellerBusinessName: company.name,
    // FBR's schema wants the seller's registered province, not necessarily
    // the branch address's province. Company.fbrProvince is a new optional
    // field (see Company model) — populate it with the value FBR expects
    // for your registration rather than guessing from a free-text address.
    sellerProvince: company.fbrProvince || null,
    sellerAddress: company.address,

    // Buyer fields are optional/required depending on buyer registration
    // type per FBR's scenario rules. These are new optional Sale fields —
    // left null until a checkout flow actually captures buyer NTN/CNIC for
    // B2B invoices that need it.
    buyerNTNCNIC: sale.buyerNTNCNIC || null,
    buyerBusinessName: sale.buyerBusinessName || null,
    buyerProvince: sale.buyerProvince || null,
    buyerAddress: sale.buyerAddress || null,
    buyerRegistrationType: sale.buyerRegistrationType || 'Unregistered',

    invoiceRefNo: sale.invoiceNumber,
    // scenarioId identifies which of FBR's documented invoicing scenarios
    // (goods/services/withholding combinations) applies to this invoice.
    // This must be chosen per your registration — do not submit a guessed
    // value; leave null until Sale.fbrScenarioId or
    // Company.fbrDefaultScenarioId is actually set.
    scenarioId: sale.fbrScenarioId || company.fbrDefaultScenarioId || null,

    items: sale.items.map((item) => ({
      // hsCode: per-product Harmonized System code, required by FBR for
      // goods invoices. Not yet captured on the Product/SaleItem model —
      // wire it through once products carry an hsCode field.
      hsCode: item.hsCode || null,
      productDescription: item.description || item.name || null,
      rate: item.taxRate != null ? `${item.taxRate}%` : null,
      uoM: item.unitOfMeasure || 'PCS',
      quantity: item.quantity,
      totalValues: item.lineTotal,
      valueSalesExcludingST: item.lineTotal - (item.taxAmount || 0),
      salesTaxApplicable: item.taxAmount || 0,
      salesTaxWithheldAtSource: item.taxWithheldAtSource || 0,
      extraTax: item.extraTax || 0,
      furtherTax: item.furtherTax || 0,
      sroScheduleNo: item.sroScheduleNo || null,
      fedPayable: item.fedPayable || 0,
      discount: item.discountAmount || 0,
      saleType: item.saleType || 'Goods at standard rate',
      sroItemSerialNo: item.sroItemSerialNo || null,
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
  if (!company) throw new Error('Company not found.');
  if (!company.fbrPosId) throw new Error('Company is not registered with an FBR POS ID.');
  if (!company.ntn) throw new Error('Company NTN is required before submitting to FBR.');

  const payload = buildInvoicePayload(sale, company);

  // Dry-run mode: log the payload instead of calling FBR, so a compliance
  // team can review the exact shape being sent before pointing at even
  // the sandbox.
  if (process.env.TAX_AUTHORITY_DRY_RUN === 'true') {
    console.log(`[FBR dry-run] (${FBR_ENV}) would POST to ${FBR_BASE_URL}/${FBR_INVOICE_PATH}:`, JSON.stringify(payload, null, 2));
    return { fbrInvoiceNumber: `DRYRUN-${sale.invoiceNumber}`, fbrQrCode: null };
  }

  const response = await fetch(`${FBR_BASE_URL}/${FBR_INVOICE_PATH}`, {
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
  // FBR returns an invoice number (its own reference for the accepted
  // invoice), which is what the QR code printed on the receipt must encode
  // per FBR's Digital Invoicing spec. Confirm the exact QR payload format
  // (typically the FBR invoice number, optionally combined with seller
  // NTN/date) against your sandbox response before generating QR codes
  // for real receipts — falling back to the invoice number alone here is
  // a reasonable default but not guaranteed to match FBR's exact spec.
  const fbrInvoiceNumber = data.invoiceNumber || data.fbrInvoiceNumber;
  const fbrQrCode = data.qrCode || data.fbrQrCode || fbrInvoiceNumber;

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
