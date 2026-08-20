const { Schema, model } = require('mongoose');

const companySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  industryType: { type: String, default: 'retail' }, // retail, restaurant, pharmacy, salon...
  ntn: String,        // National Tax Number
  strn: String,       // Sales Tax Registration Number
  fbrPosId: String,   // FBR POS registration ID
  // Optional fields consumed by fbrService.buildInvoicePayload for FBR's
  // Digital Invoicing schema. Left unset until confirmed against your
  // actual FBR registration — see src/services/taxAuthorities/README.md.
  fbrProvince: String,          // seller's registered province, as FBR expects it
  fbrDefaultScenarioId: String, // default FBR invoicing scenario for this company
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

  // Explicit chart-of-accounts wiring for the postings every module makes
  // automatically (COGS on a sale, inventory value on a GRN, payroll
  // expense, receivable/payable control accounts). Set automatically by
  // companyProvisioningService.onboardCompany() from the accounts it just
  // created — see defaultAccountsService for how a lookup here falls back
  // to a name-based guess only when a company was set up some other way.
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
