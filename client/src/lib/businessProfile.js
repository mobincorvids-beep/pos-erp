// Drives which CORE sidebar items a business actually sees, based on its
// Company.industryType. Previously every tenant's sidebar showed the
// full, identical ~26-item core menu (Manufacturing, RFQs, Appointments,
// Service orders, etc.) regardless of what kind of business it was —
// technically safe (routes were still permission/tenant-scoped) but not a
// real "dashboard for my business", just one universal menu everyone had
// to filter mentally.
//
// This file is additive to, not a replacement for, the industry-specific
// page under Sidebar's "Industry" section (see industryModuleRegistry.js)
// — that already scopes to exactly one module per tenant. This layer
// scopes the *generic* Sell/Stock/Money/People/Insights items the same
// way, so a salon doesn't see "Manufacturing" and a construction firm
// doesn't see "Appointments".
//
// Design: each nav item is tagged with which kind of business it's for.
// An item with NO tags is universal (every business needs Reports,
// Team, Customers, etc.) and is always shown. A tagged item is shown
// only if the tenant's industryType carries a matching tag. New industry
// types simply fall back to "show everything" (tags = ['*']) rather than
// hiding something a business might genuinely need — this is a curated
// narrowing for the industries we know well, not a hard allowlist.

// Tags: which flavor(s) of business need a given nav item.
const ITEM_TAGS = {
  '/appointments': ['appointment'],
  '/service-orders': ['repair'],
  '/manufacturing': ['manufacturing'],
  '/products': ['goods'],
  '/units': ['goods'],
  '/purchases': ['goods'],
  '/rfqs': ['goods'],
  '/early-payment-discount': ['goods'],
  '/stock-transfers': ['goods'],
  '/stock-counts': ['goods'],
  '/ecommerce': ['goods'],
  '/loyalty': ['retailish'],
  '/recurring-invoices': ['subscription', 'services'],
};

// Which tags each industryType carries. A business can carry several
// (e.g. a pharmacy sells physical goods AND runs a lightweight
// service/appointment counter).
const INDUSTRY_TAGS = {
  // Goods-led (buy/sell physical stock)
  retail: ['goods'], grocery: ['goods'], pharmacy: ['goods'], jewelry: ['goods'],
  electronics: ['goods'], furniture: ['goods', 'manufacturing'], fashion: ['goods'],
  bakery: ['goods', 'manufacturing'], footwear: ['goods'], textile: ['goods', 'manufacturing'],
  hardware: ['goods'], auto_parts: ['goods', 'repair'], toys_gifts: ['goods'],
  dairy: ['goods', 'manufacturing'], distribution: ['goods'], warehouse_3pl: ['goods'],
  import_export: ['goods'], agriculture: ['goods', 'manufacturing'], petrol_pump: ['goods'],
  pharmaceutical: ['goods', 'manufacturing'], grocery_wholesale: ['goods'],
  cafe: ['goods'], bakery_retail: ['goods'],

  // Appointment / service-led (little to no goods procurement)
  salon: ['appointment', 'retailish'], gym: ['appointment', 'subscription'],
  professional_services: ['services', 'subscription'], hospital: ['appointment'],
  service_station: ['appointment', 'repair'], automobile: ['repair', 'goods'],
  telecom: ['services', 'subscription'], courier: ['services'],

  // Hospitality
  restaurant: ['goods'], hotel: ['appointment', 'goods'], banquet: ['appointment'],

  // Projects / one-off, mostly non-inventory
  construction: ['goods', 'manufacturing'], real_estate: ['services'],
  insurance: ['services', 'subscription'], travel: ['services'],
  car_rental: ['services', 'appointment'], logistics: ['services'],
  ngo: ['services'], school: ['appointment', 'subscription'],
  housing_society: ['services', 'subscription'], hajj_umrah: ['services'],
  media_entertainment: ['appointment'],
};

/**
 * @param {string} industryType
 * @returns {(path: string) => boolean} true if that nav item should show
 */
export function getNavVisibility(industryType) {
  const tags = new Set(INDUSTRY_TAGS[industryType] || ['*']);
  return (path) => {
    const required = ITEM_TAGS[path];
    if (!required) return true; // universal item
    if (tags.has('*')) return true; // unknown/uncatalogued industry — don't hide anything
    return required.some((t) => tags.has(t));
  };
}
