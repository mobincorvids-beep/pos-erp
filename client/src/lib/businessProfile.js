// Drives which CORE sidebar items a business actually sees, based on its
// Company.industryType. Previously every tenant's sidebar showed the
// full, identical ~26-item core menu (Manufacturing, RFQs, Appointments,
// Service orders, etc.) regardless of what kind of business it was.
//
// This file is additive to, not a replacement for, the industry-specific
// page under Sidebar's "Industry" section (see industryModuleRegistry.js)
// — that already scopes to exactly one module per tenant. This layer
// scopes the *generic* Sell/Stock/Money/People/Insights items the same
// way, so a salon doesn't see "Manufacturing" and a grocery store doesn't
// see "RFQs" just because it also sells goods.
//
// v2 change: replaced the old coarse tag system (a single 'goods' tag
// controlled Products, Purchases, RFQs, Stock Transfers, Stock Counts,
// E-commerce all at once) with an EXPLICIT per-industry allow-list of
// visible optional items. The coarse version was wrong for real cases:
// e.g. Grocery, Pharmacy, Bakery, Toys & Gifts, Dairy, Petrol Pump, Cafe
// and Warehouse/3PL all carried 'goods' and therefore all showed RFQs —
// but per the actual business-feature spec, none of them formally
// request-for-quote from suppliers; only genuine buyer/reseller verticals
// (Retail, Jewelry, Electronics, Furniture, Fashion, Footwear, Textile,
// Hardware, Auto Parts, Distribution, Import/Export, Pharmaceutical,
// Construction) do. Same story for Loyalty (retail-adjacent only, not
// every goods business) and E-commerce (only businesses that plausibly
// run an online storefront). An explicit per-industry list makes each
// business's sidebar say exactly what that business needs — nothing
// borrowed from a shared bucket it doesn't actually belong to.
//
// Items with NO entry in any industry's list and not in OPTIONAL_ITEMS
// are universal (Reports, Customers, Suppliers, Team, HR, CRM, Banking,
// Budgets, Aging, Cost Centers, Periods, Expenses, Projects, Sales,
// Checkout, Helpdesk, Security, AI Insights) and are always shown —
// every business needs its books, its people, and its customers.

// The full set of "optional" (taggable) nav items. Anything not in this
// list is universal and always visible — see comment above.
const OPTIONAL_ITEMS = new Set([
  '/appointments', '/service-orders', '/manufacturing',
  '/products', '/units', '/purchases', '/rfqs', '/early-payment-discount',
  '/stock-transfers', '/stock-counts', '/ecommerce', '/loyalty',
  '/recurring-invoices',
  '/fleet', '/field-service', '/quality', '/contracts',
]);

// Explicit, per-industry list of which optional items that business
// actually sees — grounded in the real service file for that vertical
// (see BUSINESS_FEATURE_SPEC.md). Nothing here is inferred from a shared
// tag; every line reflects a deliberate decision about that one business.
const INDUSTRY_VISIBLE_ITEMS = {
  // ---- Goods-led retail & wholesale ----
  retail: ['products', 'units', 'purchases', 'rfqs', 'early-payment-discount', 'stock-transfers', 'stock-counts', 'ecommerce', 'loyalty'],
  grocery: ['products', 'units', 'purchases', 'stock-transfers', 'stock-counts'],
  pharmacy: ['products', 'units', 'purchases', 'stock-transfers', 'stock-counts', 'appointments'],
  jewelry: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts'],
  // Approved warranty claims open a real core ServiceOrder repair job
  // (warrantyService.js) — confirmed via direct model reference, not
  // inferred — so Service Orders needs to be visible here too.
  electronics: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'ecommerce', 'service-orders', 'field-service', 'quality'],
  furniture: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'manufacturing', 'quality'],
  fashion: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'ecommerce', 'loyalty'],
  bakery: ['products', 'units', 'purchases', 'stock-transfers', 'stock-counts', 'manufacturing', 'quality'],
  footwear: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'ecommerce'],
  textile: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'manufacturing', 'quality'],
  hardware: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'field-service'],
  auto_parts: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'service-orders', 'field-service', 'quality'],
  toys_gifts: ['products', 'units', 'purchases', 'stock-transfers', 'stock-counts', 'ecommerce'],
  dairy: ['products', 'units', 'purchases', 'stock-transfers', 'stock-counts', 'manufacturing', 'quality'],
  distribution: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'fleet'],
  // 3PL bills storage on a schedule and never buys the stock it holds —
  // no Purchases, but Recurring Invoices for contract billing. Fleet
  // covers its own delivery trucks; Contracts tracks the legal storage
  // agreement itself (separate from StorageContract's billing math — see
  // contractService.js header comment).
  warehouse_3pl: ['products', 'units', 'stock-transfers', 'stock-counts', 'recurring-invoices', 'fleet', 'contracts'],
  import_export: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'contracts'],
  agriculture: ['products', 'units', 'purchases', 'stock-transfers', 'stock-counts', 'manufacturing', 'fleet', 'field-service', 'quality'],
  petrol_pump: ['products', 'units', 'purchases', 'stock-transfers', 'stock-counts'],
  pharmaceutical: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'manufacturing', 'quality'],
  cafe: ['products', 'units', 'purchases', 'stock-transfers', 'stock-counts'],

  // ---- Appointment / service-led ----
  salon: ['appointments', 'loyalty'],
  gym: ['appointments', 'recurring-invoices'],
  professional_services: ['recurring-invoices', 'contracts'],
  hospital: ['appointments'],
  service_station: ['appointments', 'service-orders', 'field-service'],
  automobile: ['products', 'purchases', 'stock-transfers', 'stock-counts', 'service-orders', 'field-service'],
  telecom: ['recurring-invoices', 'field-service'],
  courier: ['fleet'],

  // ---- Hospitality ----
  restaurant: ['products', 'purchases', 'stock-transfers', 'stock-counts'],
  hotel: ['products', 'purchases', 'stock-transfers', 'stock-counts', 'appointments'],
  banquet: ['appointments'],

  // ---- Projects / one-off, mostly non-inventory ----
  // Construction materials procurement is real goods AND needs formal
  // supplier RFQs for material sourcing (flagged as a real gap before —
  // fixed here). Also runs vehicles/equipment (Fleet), field crews
  // (Field service), formal client/supplier contracts, and NCR/CAPA
  // quality tracking on build defects.
  construction: ['products', 'units', 'purchases', 'rfqs', 'stock-transfers', 'stock-counts', 'manufacturing', 'fleet', 'field-service', 'quality', 'contracts'],
  real_estate: ['recurring-invoices', 'contracts'],
  insurance: ['recurring-invoices', 'contracts'],
  travel: [],
  car_rental: ['appointments', 'fleet'],
  logistics: ['fleet'],
  ngo: [],
  school: ['appointments', 'recurring-invoices'],
  housing_society: ['recurring-invoices', 'contracts'],
  hajj_umrah: [],
  media_entertainment: ['appointments'],
  sports: ['products', 'units', 'purchases', 'stock-transfers', 'stock-counts', 'appointments'],
};

const PATH_TO_KEY = {
  '/appointments': 'appointments', '/service-orders': 'service-orders', '/manufacturing': 'manufacturing',
  '/products': 'products', '/units': 'units', '/purchases': 'purchases', '/rfqs': 'rfqs',
  '/early-payment-discount': 'early-payment-discount', '/stock-transfers': 'stock-transfers',
  '/stock-counts': 'stock-counts', '/ecommerce': 'ecommerce', '/loyalty': 'loyalty',
  '/recurring-invoices': 'recurring-invoices',
  '/fleet': 'fleet', '/field-service': 'field-service', '/quality': 'quality', '/contracts': 'contracts',
};

/**
 * @param {string} industryType
 * @returns {(path: string) => boolean} true if that nav item should show
 */
export function getNavVisibility(industryType) {
  const list = INDUSTRY_VISIBLE_ITEMS[industryType];
  // Unknown/uncatalogued industry types fall back to "show everything"
  // rather than hiding something a business might genuinely need.
  const unknownIndustry = list === undefined;
  const visibleSet = new Set(list || []);
  return (path) => {
    if (!OPTIONAL_ITEMS.has(path)) return true; // universal item
    if (unknownIndustry) return true;
    const key = PATH_TO_KEY[path];
    return visibleSet.has(key);
  };
}
