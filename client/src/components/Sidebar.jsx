import { NavLink } from 'react-router-dom';
import {
  ShoppingCart, Package, Wallet, Users, BarChart3, Building2, LogOut,
  CreditCard, Receipt, FileText, CalendarClock, Wrench, Boxes, ArrowLeftRight,
  ClipboardList, Factory, Banknote, Landmark, FolderKanban, PieChart,
  Contact, Truck, UserCog, HeartHandshake, Gift, Sparkles, Store, Circle,
  Ticket, Shield, FileSearch, TrendingUp, HandCoins, Repeat, Hourglass, Lock, Layers, Ruler, Percent,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INDUSTRY_MODULES } from '../industryModuleRegistry';

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
  '/stock-counts': Package, '/manufacturing': Factory,
  '/expenses': Banknote, '/banking': Landmark, '/projects': FolderKanban, '/reports': PieChart, '/budgets': TrendingUp, '/aging': Hourglass, '/periods': Lock, '/cost-centers': Layers,
  '/customers': Contact, '/suppliers': Truck, '/team': UserCog, '/hr': Users, '/employee-loans': HandCoins,
  '/crm': HeartHandshake, '/loyalty': Gift,
  '/ai-insights': Sparkles, '/ecommerce': Store, '/tickets': Ticket, '/security': Shield,
};

const SECTION_ICONS = { Sell: ShoppingCart, Stock: Package, Money: Wallet, People: Users, Insights: BarChart3, Industry: Building2 };

// Grouped by workflow proximity, not by backend module name — a cashier
// thinks "Sell", not "PosSaleService".
const SECTIONS = [
  {
    label: 'Sell',
    items: [
      { to: '/pos', label: 'Checkout' },
      { to: '/sales', label: 'Sales history' },
      { to: '/recurring-invoices', label: 'Recurring invoices' },
      { to: '/sales-workflow', label: 'Quotations & orders' },
      { to: '/appointments', label: 'Appointments' },
      { to: '/service-orders', label: 'Service orders' },
    ],
  },
  {
    label: 'Stock',
    items: [
      { to: '/products', label: 'Products' },
      { to: '/units', label: 'Units' },
      { to: '/purchases', label: 'Purchase orders' },
      { to: '/rfqs', label: 'RFQs' },
      { to: '/early-payment-discount', label: 'Early payment discount' },
      { to: '/stock-transfers', label: 'Transfers' },
      { to: '/stock-counts', label: 'Stocktakes' },
      { to: '/manufacturing', label: 'Manufacturing' },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/expenses', label: 'Expenses' },
      { to: '/banking', label: 'Banking' },
      { to: '/projects', label: 'Projects' },
      { to: '/reports', label: 'Reports' },
      { to: '/budgets', label: 'Budgets' },
      { to: '/aging', label: 'AR / AP Aging' },
      { to: '/cost-centers', label: 'Cost centers' },
      { to: '/periods', label: 'Fiscal years & periods' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/customers', label: 'Customers' },
      { to: '/suppliers', label: 'Suppliers' },
      { to: '/team', label: 'Team' },
      { to: '/security', label: 'Security' },
      { to: '/hr', label: 'HR & Payroll' },
      { to: '/employee-loans', label: 'Employee loans' },
      { to: '/crm', label: 'CRM' },
      { to: '/loyalty', label: 'Loyalty' },
      { to: '/tickets', label: 'Helpdesk' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/ai-insights', label: 'Insights' },
      { to: '/ecommerce', label: 'E-commerce' },
    ],
  },
  {
    label: 'Industry',
    items: INDUSTRY_MODULES.map(({ path, label }) => ({ to: path, label })),
  },
];

export function Sidebar({ mobileOpen, onClose }) {
  const { company, logout, user } = useAuth();

  const content = (
    <>
      <div className="px-4 py-4 border-b border-rule flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-display text-lg leading-none text-ink">Muhasib</p>
          <p className="text-xs text-ink-muted mt-1 truncate">{company?.name || '—'}</p>
        </div>
        {/* Close button only rendered/visible in the mobile drawer — the static desktop sidebar has no need for it. */}
        <button onClick={onClose} className="md:hidden text-ink-muted hover:text-ink text-xl leading-none px-1" aria-label="Close menu">
          ×
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {SECTIONS.map((section) => {
          const SectionIcon = SECTION_ICONS[section.label] || Circle;
          return (
            <div key={section.label} className="mb-4">
              <p className="px-4 mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted/70">
                <SectionIcon size={12} strokeWidth={2.5} />
                {section.label}
              </p>
              {section.items.map((item) => {
                const ItemIcon = ITEM_ICONS[item.to] || Circle;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-4 py-1.5 text-sm mx-2 rounded ${
                        isActive ? 'bg-accent-soft text-accent-strong font-medium' : 'text-ink hover:bg-paper'
                      }`
                    }
                  >
                    <ItemIcon size={15} strokeWidth={2} className="shrink-0 opacity-70" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-rule px-4 py-3">
        <p className="text-sm text-ink truncate">{user?.name}</p>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-danger mt-0.5">
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Static sidebar — desktop/tablet only. Always in the layout flow, never overlays content. */}
      <aside className="hidden md:flex w-56 shrink-0 h-screen sticky top-0 bg-surface border-r border-rule flex-col">
        {content}
      </aside>

      {/* Mobile drawer — an overlay + slide-in panel, only mounted below the md breakpoint.
          Backdrop click and the × button both close it; navigating also closes it (onClose above). */}
      <div className={`md:hidden fixed inset-0 z-40 ${mobileOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-ink/30 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
          aria-hidden="true"
        />
        <aside
          className={`absolute inset-y-0 left-0 w-64 bg-surface border-r border-rule flex flex-col transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {content}
        </aside>
      </div>
    </>
  );
}
