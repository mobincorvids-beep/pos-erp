import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { INDUSTRY_MODULES } from '../industryModuleRegistry';

// Grouped by workflow proximity, not by backend module name — a cashier
// thinks "Sell", not "PosSaleService".
const SECTIONS = [
  {
    label: 'Sell',
    items: [
      { to: '/pos', label: 'Checkout' },
      { to: '/sales', label: 'Sales history' },
      { to: '/sales-workflow', label: 'Quotations & orders' },
      { to: '/appointments', label: 'Appointments' },
      { to: '/service-orders', label: 'Service orders' },
    ],
  },
  {
    label: 'Stock',
    items: [
      { to: '/products', label: 'Products' },
      { to: '/purchases', label: 'Purchase orders' },
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
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/customers', label: 'Customers' },
      { to: '/suppliers', label: 'Suppliers' },
      { to: '/team', label: 'Team' },
      { to: '/hr', label: 'HR & Payroll' },
      { to: '/crm', label: 'CRM' },
      { to: '/loyalty', label: 'Loyalty' },
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
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted/70">
              {section.label}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `block px-4 py-1.5 text-sm mx-2 rounded ${
                    isActive ? 'bg-accent-soft text-accent-strong font-medium' : 'text-ink hover:bg-paper'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-rule px-4 py-3">
        <p className="text-sm text-ink truncate">{user?.name}</p>
        <button onClick={logout} className="text-xs text-ink-muted hover:text-danger mt-0.5">
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
