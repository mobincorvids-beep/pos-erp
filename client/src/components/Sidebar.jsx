import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShoppingCart, Package, Wallet, Users, BarChart3, Building2, LogOut,
  CreditCard, Receipt, FileText, CalendarClock, Wrench, Boxes, ArrowLeftRight,
  ClipboardList, Factory, Banknote, Landmark, FolderKanban, PieChart,
  Contact, Truck, UserCog, HeartHandshake, Gift, Sparkles, Store, Circle,
  Ticket, Shield, FileSearch, TrendingUp, HandCoins, Repeat, Hourglass, Lock, Layers, Ruler, Percent, X,
  LayoutDashboard, Settings, Car, MapPin, ShieldAlert, FileSignature,
  PackageCheck, Warehouse, UserPlus, Target, Rocket, KeyRound, Radio, Timer, SlidersHorizontal, Pin, PinOff,
  Paperclip, BookOpen, Workflow, Star, Clock, Send, MessageCircle, Milestone, Tags,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INDUSTRY_MODULES } from '../industryModuleRegistry';
import { getNavVisibility } from '../lib/businessProfile';

// One icon per nav item — a real, intentional choice per destination
// rather than a generic bullet, so the sidebar can be scanned visually,
// not just read line by line. Anything not explicitly mapped (mainly the
// 22 industry-module links, where a single shared icon per link would be
// more noise than signal at that volume) falls back to a plain dot rather
// than rendering a missing/broken icon.
const ITEM_ICONS = {
  '/pos': CreditCard, '/sales': Receipt, '/sales-workflow': FileText, '/recurring-invoices': Repeat,
  '/appointments': CalendarClock, '/service-orders': Wrench,
  '/products': Boxes, '/units': Ruler, '/purchases': ClipboardList, '/rfqs': FileSearch, '/early-payment-discount': Percent, '/stock-transfers': ArrowLeftRight,
  '/stock-counts': Package, '/manufacturing': Factory, '/subcontracting': Send,
  '/expenses': Banknote, '/banking': Landmark, '/cheques': FileSignature, '/fbr-compliance': ShieldAlert, '/projects': FolderKanban, '/reports': PieChart, '/budgets': TrendingUp, '/aging': Hourglass, '/periods': Lock, '/cost-centers': Layers,
  '/customers': Contact, '/suppliers': Truck, '/team': UserCog, '/hr': Users, '/employee-loans': HandCoins, '/timesheets': Timer, '/my-attendance': Clock,
  '/my-route': Milestone, '/price-lists': Tags,
  '/crm': HeartHandshake, '/loyalty': Gift,
  '/ai-insights': Sparkles, '/ecommerce': Store, '/tickets': Ticket, '/security': Shield,
  '/fleet': Car, '/field-service': MapPin, '/quality': ShieldAlert, '/contracts': FileSignature, '/documents': Paperclip,
  '/logistics-core': PackageCheck, '/warehouse': Warehouse, '/recruitment': UserPlus,
  '/performance': Target, '/funnels': Rocket, '/reputation': Star, '/marketing-automation': Workflow, '/developer-platform': KeyRound, '/ecommerce-hub': Radio,
  '/knowledge-base': BookOpen, '/whatsapp-log': MessageCircle,
};

const SECTION_ICONS = { Sell: ShoppingCart, Stock: Package, Money: Wallet, People: Users, Insights: BarChart3, Industry: Building2 };

// Grouped by workflow proximity, not by backend module name — a cashier
// thinks "Sell", not "PosSaleService". Labels are i18n keys (resolved via
// t() at render time) rather than literal English strings — see
// client/src/i18n/README.md for how this maps to translation.json.
const SECTIONS = [
  {
    label: 'Sell',
    sectionKey: 'nav.sections.sell',
    items: [
      { to: '/pos', labelKey: 'nav.items.checkout' },
      { to: '/sales', labelKey: 'nav.items.salesHistory' },
      { to: '/recurring-invoices', labelKey: 'nav.items.recurringInvoices' },
      { to: '/sales-workflow', labelKey: 'nav.items.quotationsOrders' },
      { to: '/appointments', labelKey: 'nav.items.appointments' },
      { to: '/service-orders', labelKey: 'nav.items.serviceOrders' },
      { to: '/field-service', labelKey: 'nav.items.fieldService' },
    ],
  },
  {
    label: 'Stock',
    sectionKey: 'nav.sections.stock',
    items: [
      { to: '/products', labelKey: 'nav.items.products' },
      { to: '/price-lists', labelKey: 'nav.items.priceLists' },
      { to: '/categories', labelKey: 'nav.items.categories' },
      { to: '/units', labelKey: 'nav.items.units' },
      { to: '/purchases', labelKey: 'nav.items.purchaseOrders' },
      { to: '/rfqs', labelKey: 'nav.items.rfqs' },
      { to: '/early-payment-discount', labelKey: 'nav.items.earlyPaymentDiscount' },
      { to: '/stock-transfers', labelKey: 'nav.items.transfers' },
      { to: '/stock-counts', labelKey: 'nav.items.stocktakes' },
      { to: '/manufacturing', labelKey: 'nav.items.manufacturing' },
      { to: '/subcontracting', labelKey: 'nav.items.subcontracting' },
      { to: '/quality', labelKey: 'nav.items.quality' },
      { to: '/fleet', labelKey: 'nav.items.fleetTransport' },
      { to: '/logistics-core', labelKey: 'nav.items.shipments' },
      { to: '/warehouse', labelKey: 'nav.items.warehouseLocations' },
    ],
  },
  {
    label: 'Money',
    sectionKey: 'nav.sections.money',
    items: [
      { to: '/expenses', labelKey: 'nav.items.expenses' },
      { to: '/banking', labelKey: 'nav.items.banking' },
      { to: '/cheques', labelKey: 'nav.items.cheques' },
      { to: '/fbr-compliance', labelKey: 'nav.items.fbrCompliance' },
      { to: '/projects', labelKey: 'nav.items.projects' },
      { to: '/reports', labelKey: 'nav.items.reports' },
      { to: '/budgets', labelKey: 'nav.items.budgets' },
      { to: '/aging', labelKey: 'nav.items.agingArAp' },
      { to: '/cost-centers', labelKey: 'nav.items.costCenters' },
      { to: '/periods', labelKey: 'nav.items.fiscalYearsPeriods' },
      { to: '/fixed-assets', labelKey: 'nav.items.fixedAssets' },
      { to: '/contracts', labelKey: 'nav.items.contractsLegal' },
      { to: '/documents', labelKey: 'nav.items.documents' },
    ],
  },
  {
    label: 'People',
    sectionKey: 'nav.sections.people',
    items: [
      { to: '/customers', labelKey: 'nav.items.customers' },
      { to: '/suppliers', labelKey: 'nav.items.suppliers' },
      { to: '/team', labelKey: 'nav.items.team' },
      { to: '/security', labelKey: 'nav.items.security' },
      { to: '/hr', labelKey: 'nav.items.hrPayroll' },
      { to: '/my-attendance', labelKey: 'nav.items.myAttendance' },
      { to: '/my-route', labelKey: 'nav.items.myRoute' },
      { to: '/employee-loans', labelKey: 'nav.items.employeeLoans' },
      { to: '/timesheets', labelKey: 'nav.items.timesheets' },
      { to: '/recruitment', labelKey: 'nav.items.recruitment' },
      { to: '/performance', labelKey: 'nav.items.performanceGoals' },
      { to: '/crm', labelKey: 'nav.items.crm' },
      { to: '/funnels', labelKey: 'nav.items.funnels' },
      { to: '/reputation', labelKey: 'nav.items.reputation' },
      { to: '/marketing-automation', labelKey: 'nav.items.marketingAutomation' },
      { to: '/whatsapp-log', labelKey: 'nav.items.whatsappLog' },
      { to: '/loyalty', labelKey: 'nav.items.loyalty' },
      { to: '/tickets', labelKey: 'nav.items.helpdesk' },
      { to: '/knowledge-base', labelKey: 'nav.items.knowledgeBase' },
      { to: '/chat', labelKey: 'nav.items.teamChat' },
      { to: '/calendar', labelKey: 'nav.items.calendar' },
      { to: '/maintenance', labelKey: 'nav.items.maintenance' },
    ],
  },
  {
    label: 'Insights',
    sectionKey: 'nav.sections.insights',
    items: [
      { to: '/ai-insights', labelKey: 'nav.items.insights' },
      { to: '/ecommerce', labelKey: 'nav.items.ecommerce' },
      { to: '/ecommerce-hub', labelKey: 'nav.items.ecommerceHub' },
      { to: '/developer-platform', labelKey: 'nav.items.developerPlatform' },
    ],
  },
];

export function Sidebar({ mobileOpen, onClose }) {
  const { t } = useTranslation();
  const { company, logout, user } = useAuth();
  // Only surface the ONE industry module this tenant actually has (if
  // any) — previously every tenant's sidebar listed all ~30 industry
  // modules regardless of plan, and clicking one for a module the tenant
  // doesn't have rendered a fully interactive page that only failed once
  // you tried to submit (see IndustryModuleGate in App.jsx, which still
  // blocks direct URL access as a second layer).
  const enabledIndustryModules = INDUSTRY_MODULES.filter((m) => m.key === company?.industryType);

  // v4: out-of-scope items are hidden by default again — no muted styling,
  // no "extra" badge, just absent from the normal view. What counts as
  // "in scope" is itself customizable, per-company, and client-only
  // (localStorage, keyed by company id) — a vendor whose business spans
  // verticals can explicitly reveal an out-of-scope item, or hide an
  // in-scope one, via "Customize sidebar" mode below. The override map
  // takes precedence over the industry-default relevance from
  // lib/businessProfile.js. In customize mode ALL items render (so the
  // vendor can see everything that exists) with pin/unpin controls; in the
  // normal view only in-scope items render, at all.
  const overridesKey = company?.id ? `pos_erp_sidebar_overrides_${company.id}` : null;
  const [overrides, setOverrides] = useState({});
  const [customizeMode, setCustomizeMode] = useState(false);

  useEffect(() => {
    if (!overridesKey) return;
    try {
      const raw = localStorage.getItem(overridesKey);
      setOverrides(raw ? JSON.parse(raw) : {});
    } catch {
      // localStorage unavailable, or corrupt JSON — fall back to no overrides.
      setOverrides({});
    }
  }, [overridesKey]);

  function setOverride(path, value) {
    setOverrides((current) => {
      const next = { ...current };
      if (value === null) {
        delete next[path];
      } else {
        next[path] = value;
      }
      if (overridesKey) {
        try {
          localStorage.setItem(overridesKey, JSON.stringify(next));
        } catch {
          // best-effort persistence only
        }
      }
      return next;
    });
  }

  // Industry-default relevance (the same per-business logic as before), now
  // used only to decide styling — never to filter items out of the list.
  const isDefaultRelevant = getNavVisibility(company?.industryType, false);
  function isInScope(path) {
    const override = overrides[path];
    if (override === 'in') return true;
    if (override === 'out') return false;
    return isDefaultRelevant(path);
  }

  // Normal view: filter each section down to in-scope items only — an
  // out-of-scope item is not rendered at all (not muted, not badged).
  // Customize mode: show every item, unfiltered, so the vendor can see
  // everything that exists and pin/unpin it.
  const visibleSections = customizeMode
    ? SECTIONS
    : SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => isInScope(item.to)),
      })).filter((section) => section.items.length > 0);

  // Shared classes for every nav row — a bold, filled active state (dark
  // accent bg + white text + a left accent-strong border stripe) rather
  // than the old soft-tint active state, matching the SafePOS design
  // system's nav treatment. rtl:border-l-0 rtl:border-r-4 flips the
  // accent stripe to the visual "leading" edge under dir="rtl".
  const linkClass = () => ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 text-sm mx-2 rounded-lg font-semibold border-l-4 rtl:border-l-0 rtl:border-r-4 transition-colors ${
      isActive
        ? 'bg-accent text-white border-accent-strong shadow-sm'
        : 'text-ink border-transparent hover:bg-surface-sunken'
    }`;

  const content = (
    <>
      <div className="px-5 pt-5 pb-6 flex items-center justify-between">
        <div className="min-w-0 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent text-white flex items-center justify-center font-display font-bold text-base shrink-0">
            {(company?.name || 'M').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg leading-none text-ink font-bold">Muhasib</p>
            <p className="eyebrow mt-1 truncate">{company?.name || 'Enterprise Ledger'}</p>
          </div>
        </div>
        {/* Close button only rendered/visible in the mobile drawer, the static desktop sidebar has no need for it. */}
        <button onClick={onClose} className="md:hidden text-ink-muted hover:text-ink px-1" aria-label="Close menu">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        <div className="mb-4">
          <NavLink to="/dashboard" end onClick={onClose} className={linkClass()}>
            <LayoutDashboard size={17} strokeWidth={2} className="shrink-0" />
            {t('nav.home')}
          </NavLink>
        </div>
        {visibleSections.map((section) => {
          const SectionIcon = SECTION_ICONS[section.label] || Circle;
          return (
            <div key={section.label} className="mb-4">
              <p className="px-5 mb-1.5 flex items-center gap-1.5 eyebrow">
                <SectionIcon size={12} strokeWidth={2.5} />
                {t(section.sectionKey)}
              </p>
              {section.items.map((item) => {
                const ItemIcon = ITEM_ICONS[item.to] || Circle;
                const inScope = isInScope(item.to);
                const override = overrides[item.to];
                return (
                  <div key={item.to} className="group relative">
                    <NavLink to={item.to} onClick={onClose} className={linkClass()}>
                      <ItemIcon size={17} strokeWidth={2} className="shrink-0" />
                      <span className="flex-1 truncate">{t(item.labelKey)}</span>
                    </NavLink>
                    {customizeMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOverride(item.to, override ? null : (inScope ? 'out' : 'in'));
                        }}
                        title={
                          override
                            ? 'Remove custom override: use default relevance for this item'
                            : inScope
                              ? 'Mark this item irrelevant for your business'
                              : 'Keep this item visible without graying it out'
                        }
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md ${
                          override ? 'text-accent' : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        {inScope ? <PinOff size={14} strokeWidth={2} /> : <Pin size={14} strokeWidth={2} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {enabledIndustryModules.length > 0 && (
          <div className="mb-4">
            <p className="px-5 mb-1.5 flex items-center gap-1.5 eyebrow">
              <Building2 size={12} strokeWidth={2.5} />
              {t('nav.sections.industry')}
            </p>
            {enabledIndustryModules.map((item) => (
              <NavLink key={item.path} to={item.path} onClick={onClose} className={linkClass()}>
                <Circle size={17} strokeWidth={2} className="shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Settings is deliberately outside businessProfile.js scoping, every
          business, whatever its industry, needs a place to manage its own
          profile and branches, so this is never hidden per business type. */}
      <div className="mb-1">
        <NavLink to="/settings" onClick={onClose} className={linkClass()}>
          <Settings size={17} strokeWidth={2} className="shrink-0" />
          {t('nav.settings')}
        </NavLink>
      </div>

      {/* Out-of-scope items are hidden by default. "Customize sidebar" mode
          reveals every item (with a per-item pin/unpin control) so a vendor
          whose business genuinely spans verticals can explicitly turn on an
          out-of-scope item, or turn off an in-scope one, instead of a single
          all-or-nothing "Show all modules" switch. */}
      <div className="px-5 pt-1 pb-2">
        <button
          type="button"
          onClick={() => setCustomizeMode((v) => !v)}
          className="w-full flex items-center gap-2 text-xs text-ink-muted hover:text-ink"
          aria-pressed={customizeMode}
        >
          <SlidersHorizontal size={13} strokeWidth={2} className="shrink-0" />
          <span className="flex-1 text-left">{customizeMode ? 'Done customizing' : 'Customize sidebar'}</span>
          <span
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
              customizeMode ? 'bg-accent' : 'bg-rule-strong'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                customizeMode ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      </div>

      <div className="border-t border-rule px-5 py-4 mt-1">
        <p className="text-sm font-semibold text-ink truncate">{user?.name}</p>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-danger mt-1">
          <LogOut size={13} />
          {t('nav.signOut')}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Static sidebar: desktop/tablet only. Always in the layout flow, never overlays content. */}
      <aside className="hidden md:flex w-[264px] shrink-0 h-screen sticky top-0 bg-surface-sunken border-r border-rule flex-col">
        {content}
      </aside>

      {/* Mobile drawer: an overlay + slide-in panel, only mounted below the md breakpoint.
          Backdrop click and the × button both close it; navigating also closes it (onClose above).
          rtl:left-auto rtl:right-0 + rtl:translate-x-full flip the drawer to slide in from the
          visual "start" edge (the right, in RTL) instead of always sliding from the left. */}
      <div className={`md:hidden fixed inset-0 z-40 ${mobileOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-ink/30 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
          aria-hidden="true"
        />
        <aside
          className={`absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 w-72 bg-surface-sunken border-r border-rule rtl:border-r-0 rtl:border-l flex flex-col transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
          }`}
        >
          {content}
        </aside>
      </div>
    </>
  );
}
