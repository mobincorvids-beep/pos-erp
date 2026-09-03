const { Schema, model } = require('mongoose');

const companySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  industryType: { type: String, default: 'retail' }, // retail, restaurant, pharmacy, salon, wholesaler, manufacturer, distributor...
  ntn: String,        // National Tax Number
  strn: String,       // Sales Tax Registration Number
  fbrPosId: String,   // FBR POS registration ID
  // Each vendor has their own separate FBR IRIS registration and Bearer
  // token — there is no shared/platform-wide FBR account, so this is
  // entered per-company under Settings, same self-service pattern as
  // jazzCashTaxPay below. TODO(security): encrypt at rest in production —
  // stored plain for now, no existing encryption helper in this codebase
  // to reuse (same caveat already noted on jazzCashTaxPay.password below).
  fbrApiToken: { type: String, default: null },
  // FBR's sandbox and production Digital Invoicing environments are
  // authenticated by different tokens against the SAME host
  // (gw.fbr.gov.pk/di_data/v1/di) per FBR's own integration guides — this
  // flag exists so fbrService picks the right token lifecycle stage to
  // report in errors/UI, not to switch hosts. Vendor turns this off once
  // they've requested and received a production token from IRIS.
  fbrSandboxMode: { type: Boolean, default: true },
  phone: String,
  email: String,
  address: String,
  currency: { type: String, default: 'PKR' },
  timezone: { type: String, default: 'Asia/Karachi' },
  isActive: { type: Boolean, default: true },

  // Which industry modules are switched on for this tenant.
  // Core stays generic; modules register routes only when active here.
  activeModules: [{ type: String }], // e.g. ['restaurant', 'loyalty']
  // Which tax authority a sale gets submitted to for digital invoicing.
  // A company can be registered with more than one — e.g. FBR federally
  // for goods and SRB provincially for services — so this is a list, not
  // a single enum. See taxComplianceService for the dispatch logic.
  taxAuthorities: [{ type: String, enum: ['fbr', 'srb', 'pra', 'kpra', 'bra'] }],
  // Which Pakistani province the business is registered/operating in — used
  // (together with businessNature below) purely to suggest the right
  // provincial authority in Settings; taxAuthorities above remains the
  // actual, explicit source of truth for where sales are filed.
  province: { type: String, default: null, enum: ['sindh', 'punjab', 'kp', 'balochistan', 'islamabad', 'other', null] },
  // Goods are taxed federally by FBR; services fall under the province's own
  // revenue authority (SRB/PRA/KPRA/BRA) instead. A business can sell both
  // (e.g. a restaurant selling packaged goods at the counter too), hence
  // 'both' rather than a strict either/or.
  businessNature: { type: String, default: 'goods', enum: ['goods', 'services', 'both'] },

  // Multi-company grouping — a holding business running several registered
  // companies (e.g. separate legal entities per city) that wants a combined
  // view. Self-referencing rather than a separate "Group" collection: the
  // parent company IS itself a member of its own group, so there's exactly
  // one place to look, not a company row plus a group row that can drift apart.
  parentCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },

  // E-commerce integration — an external store (Shopify-style) posts orders
  // to POST /ecommerce/:slug/orders and pulls the catalog from
  // GET /ecommerce/:slug/products, authenticated by webhookToken rather
  // than a tenant JWT (an external system has no user session). Orders land
  // through the same posSaleService.checkout() as a counter sale — see
  // ecommerceService — with defaultWarehouseId/defaultPaymentAccountId
  // telling it where stock comes from and how an already-paid online order
  // gets recorded.
  ecommerceConfig: {
    enabled: { type: Boolean, default: false },
    webhookToken: { type: String, default: null },
    defaultBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    defaultWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    defaultPaymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  },

  // Where a confirmed JazzCash/Easypaisa collection against an EXISTING
  // due sale/invoice (as opposed to a fresh POS checkout, which already
  // carries its own paymentAccountId on the payments[] line) lands —
  // paymentGatewayController.callback() needs a cash/bank account to post
  // the resulting CustomerPayment into and has no checkout request to read
  // one from. Same "small per-company settings block" shape as
  // ecommerceConfig above.
  paymentGatewayConfig: {
    defaultPaymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  },

  // Explicit chart-of-accounts wiring for the postings every module makes
  // automatically (COGS on a sale, inventory value on a GRN, payroll
  // expense, receivable/payable control accounts). Set automatically by
  // companyProvisioningService.onboardCompany() from the accounts it just
  // created — see defaultAccountsService for how a lookup here falls back
  // to a name-based guess only when a company was set up some other way.
  // Per-tenant JazzCash credentials used ONLY for paying this company's OWN
  // tax liability to FBR (Bill Payment / Tax Payment API family) — kept
  // entirely separate from the platform-wide JAZZCASH_* env vars that
  // jazzCashService.js uses for customer-facing POS checkout, since each
  // vendor connects their own JazzCash merchant account for this flow.
  // NOTE: password/integritySalt are sensitive credentials stored as-is
  // below — no encrypted-field pattern exists elsewhere in this codebase
  // (grepped for "encrypt", found none) to reuse, so production deployments
  // should add field-level encryption-at-rest for these two before go-live.
  jazzCashTaxPay: {
    enabled: { type: Boolean, default: false },
    merchantId: { type: String, default: null },
    password: { type: String, default: null }, // TODO(security): encrypt at rest in production — stored plain for now, no existing encryption helper in this codebase to reuse.
    integritySalt: { type: String, default: null }, // TODO(security): encrypt at rest in production, see note above.
    fbrAccountNumber: { type: String, default: null },
    fbrAccountTitle: { type: String, default: null },
  },

  // Per-tenant WhatsApp Business Cloud API credentials (Meta) — same
  // self-service pattern as fbrApiToken/jazzCashTaxPay above: there is no
  // shared/platform-wide WhatsApp sender, each vendor connects their own
  // WhatsApp Business Account under Settings so order confirmations,
  // invoices and payment reminders go out from THEIR number, not a shared
  // one. See src/services/whatsappService.js for the send-side no-op
  // behavior when these aren't configured.
  whatsappEnabled: { type: Boolean, default: false },
  whatsappPhoneNumberId: { type: String, default: null }, // Meta "Phone number ID" (not the phone number itself)
  whatsappBusinessAccountId: { type: String, default: null }, // Meta WABA ID
  // TODO(security): encrypt at rest in production — stored plain for now,
  // no existing encryption helper in this codebase to reuse, same caveat
  // already noted on fbrApiToken/jazzCashTaxPay.password above.
  whatsappAccessToken: { type: String, default: null },

  defaultAccounts: {
    inventoryAssetId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    costOfGoodsSoldId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    accountsReceivableId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    accountsPayableId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    salariesExpenseId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    salesTaxPayableId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    salesRevenueId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  },
}, { timestamps: true });

module.exports = model('Company', companySchema);
