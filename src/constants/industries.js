/**
 * Reference catalog for Company.industryType and Company.activeModules.
 * Not DB-enforced (both fields are free-text strings, so a custom industry
 * doesn't require a migration) — this is what the admin UI's dropdowns and
 * toggles are populated from.
 *
 * INDUSTRIES is now AUTO-DERIVED from every module's manifest.js (see
 * src/routes/mountIndustryModules.js for the same discovery mechanism the
 * router itself uses) — adding a real, working industry module to this
 * catalog now requires ZERO edits to this file. Only two kinds of entries
 * are still hand-listed here, because neither has a manifest to derive
 * from: the two CORE modules that are always on for every company with no
 * activeModules gate (manufacturing, ecommerce — genuinely not industry
 * bolt-ons), and the industries that DON'T have a module yet at all,
 * which obviously can't be discovered from code that doesn't exist.
 */
const fs = require('fs');
const path = require('path');
const { MODULES_DIR } = require('../routes/mountIndustryModules');

function discoverBuiltIndustries() {
  if (!fs.existsSync(MODULES_DIR)) return [];
  const discovered = [];
  for (const entry of fs.readdirSync(MODULES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(MODULES_DIR, entry.name, 'manifest.js');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = require(manifestPath);
    if (manifest.key && manifest.label) discovered.push({ key: manifest.key, label: manifest.label, category: manifest.category || 'Other', hasModule: true });
  }
  return discovered.sort((a, b) => a.label.localeCompare(b.label));
}

// Core modules always on for every company — not industry bolt-ons, so they
// have no manifest.js and can't be auto-discovered the way real industry
// modules are. See routes/index.js and routes/manufacturingRoutes.js /
// routes/ecommerceConfigRoutes.js — mounted exactly like HR, Purchasing,
// or any other core module, with no requireActiveModule gate.
const CORE_ALWAYS_ON = [
  { key: 'manufacturing', label: 'Manufacturing', category: 'Industrial', hasModule: true },
  { key: 'ecommerce', label: 'E-commerce', category: 'Retail & Commerce', hasModule: true },
];

// Industries with no module built yet — see MERGE ANALYSIS below for the
// honest reasoning behind each. These obviously can't be auto-discovered;
// this is the one place genuinely open work still needs to be listed by hand.
const NOT_YET_BUILT = [
  { key: 'pharmaceutical', label: 'Pharmaceutical (Manufacturing/Distribution)', category: 'Health & Wellness', hasModule: false },
  { key: 'construction', label: 'Construction', category: 'Trade Crafts & Construction', hasModule: false },
  { key: 'import_export', label: 'Import / Export', category: 'Logistics & Distribution', hasModule: false },
  { key: 'telecom', label: 'Telecom', category: 'Electronics & Telecom', hasModule: false },
  { key: 'real_estate', label: 'Real Estate', category: 'Property', hasModule: false },
  { key: 'housing_society', label: 'Housing Society', category: 'Property', hasModule: false },
  { key: 'travel', label: 'Travel', category: 'Travel & Pilgrimage', hasModule: false },
  { key: 'hajj_umrah', label: 'Hajj / Umrah', category: 'Travel & Pilgrimage', hasModule: false },
  { key: 'insurance', label: 'Insurance', category: 'Finance & Risk', hasModule: false },
  { key: 'professional_services', label: 'Professional Services', category: 'Services', hasModule: false },
  { key: 'ngo', label: 'NGO', category: 'Services', hasModule: false },
  { key: 'media_entertainment', label: 'Media / Entertainment', category: 'Services', hasModule: false },
  { key: 'sports', label: 'Sports', category: 'Services', hasModule: false },
  { key: 'government', label: 'Government', category: 'Services', hasModule: false },
];

const INDUSTRIES = [...discoverBuiltIndustries(), ...CORE_ALWAYS_ON, ...NOT_YET_BUILT];

// Modules a company can independently switch on regardless of its primary
// industryType (e.g. a retail shop that also wants Appointments for a
// services counter). Also now auto-derived from the same manifests, with
// the description strings each module's manifest carries for exactly this list.
function discoverOptionalModules() {
  if (!fs.existsSync(MODULES_DIR)) return [];
  const discovered = [];
  for (const entry of fs.readdirSync(MODULES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(MODULES_DIR, entry.name, 'manifest.js');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = require(manifestPath);
    if (manifest.key && manifest.label) {
      discovered.push({ key: manifest.key, label: manifest.optionalModuleLabel || manifest.label, hasModule: true });
    }
  }
  return discovered.sort((a, b) => a.label.localeCompare(b.label));
}

const OPTIONAL_MODULES = discoverOptionalModules();

/**
 * MERGE ANALYSIS — the honest architectural mapping for the ~13
 * not-yet-built industries above, showing exactly which existing mechanic
 * each would reuse and what (if anything) is genuinely new. This reasoning
 * doesn't change just because the registry mechanism did — it's copied
 * forward unchanged from before the auto-discovery refactor.
 *
 * MERGE-ABLE (a real module here is genuinely the right call):
 * - Hajj/Umrah: Gym's capacity+waitlist (fixed pilgrimage group quota) +
 *   Retail's Layaway (cumulative installment payments toward a package
 *   price) combined. Both mechanics already exist and already work
 *   correctly independently — genuinely just wiring, not new algorithms.
 * - Travel: Hotel/Banquet's exact deposit-then-bill-remainder pattern,
 *   applied to a trip package instead of a room/venue. No new mechanic at all.
 * - Insurance: Cafe's subscription-billing pattern for recurring premiums
 *   + Electronics' warranty-claim workflow (submit, decide, resolve) for
 *   claims — both proven patterns, applied to a different noun.
 * - Media/Entertainment (ticketing): Gym's capacity+waitlist directly,
 *   for a screening/show instead of a class session.
 * - Sports: Salon/Gym's membership pattern for club dues + Hotel/Banquet's
 *   booking pattern for facility reservations. No new mechanic.
 * - Telecom (partially): Cafe's subscription pattern covers recurring
 *   plan fees completely; usage-metered billing (call/SMS/data) is a
 *   real, separate, NOT-yet-existing mechanic — Telecom is only a partial merge.
 * - NGO (partially): Customer already covers donor records; core
 *   Accounting's multi-account structure already supports segregating
 *   funds by account. A thin "Fund" tag linking transactions to a
 *   restricted/unrestricted designation is the one genuinely new piece —
 *   small, but real, not assumed to be zero.
 *
 * NEEDS REAL NEW WORK, BUT STILL FITS THIS PLATFORM (not a separate app,
 * just not a pure reuse either):
 * - Import/Export: landed cost (customs duty, freight, insurance
 *   allocated proportionally across a PurchaseOrder's line items) doesn't
 *   exist on core Purchasing today.
 * - Professional Services: billable hours + retainer billing needs an
 *   actual TimeEntry concept that doesn't exist anywhere in core today.
 * - Construction: core Projects & Job Costing already covers real-time
 *   cost tracking against a project. What's missing is estimate/BOQ
 *   (bill of quantities) tooling before a project starts.
 *
 * GENUINELY STRETCHES THE CORE DATA MODEL:
 * - Real Estate / Housing Society: needs a real `Property` concept core
 *   doesn't have — closer in scope to Hospital's Visit or Hotel's
 *   Reservation than to a thin reuse. Worth building here, sized accordingly.
 * - Pharmaceutical: mostly IS Pharmacy + core Manufacturing at wholesale/
 *   manufacturer scale — likely sufficient as-is, but unverified without
 *   a real pharmaceutical company's workflow to check the claim against.
 *
 * NOT MERGED — genuinely doesn't have a clear POS/ERP shape here:
 * - Government: not one business shape the way "Hotel" or "Insurance" is
 *   — left unscoped honestly rather than guessed at.
 */

module.exports = { INDUSTRIES, OPTIONAL_MODULES };
