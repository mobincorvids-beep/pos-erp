import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Check,
  ChevronDown,
  ShoppingCart,
  PlusCircle,
  Banknote,
  CalendarClock,
  TrendingUp,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/Loading';
import { MetricCard } from '../components/MetricCard';
import { formatMoney, formatDate, formatDateTime, formatQty } from '../lib/format';

const ACTIVE_BRANCH_KEY = 'pos_erp_active_branch';

// The industry-tailored home screen: a CORE row every business owner
// wants regardless of trade, plus a section chosen server-side off the
// company's real industryType (dashboardService.getHomeDashboard). Every
// industry without a bespoke section still gets a real page — CORE alone,
// never an empty screen — so this component just renders whatever
// `industry` comes back, including null.
export function HomeDashboardPage() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_BRANCH_KEY) || '';
    } catch {
      return '';
    }
  });
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const branchMenuRef = useRef(null);

  useEffect(() => {
    api.get('/dashboard/home').then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
    api.get('/org/branches').then((rows) => {
      setBranches(rows || []);
      // No stored choice yet, or the stored branch no longer exists — default
      // to the first (usually only) branch so the row never shows a blank state.
      setActiveBranchId((current) => {
        if (current && rows?.some((b) => b._id === current)) return current;
        return rows?.[0]?._id || '';
      });
    }).catch(() => {});
  }, []);

  // Close the branch menu on an outside click.
  useEffect(() => {
    if (!branchMenuOpen) return undefined;
    function handleClick(e) {
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target)) setBranchMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [branchMenuOpen]);

  function selectBranch(branchId) {
    setActiveBranchId(branchId);
    try {
      localStorage.setItem(ACTIVE_BRANCH_KEY, branchId);
    } catch {
      // localStorage unavailable (private browsing etc.) — selection still
      // works for this render, it just won't persist across reloads.
    }
    setBranchMenuOpen(false);
  }

  const activeBranch = branches.find((b) => b._id === activeBranchId);
  const hasMultipleBranches = branches.length > 1;

  return (
    <div>
      <p className="page-title mb-1">{t('dashboard.home')}</p>
      <p className="text-sm text-ink-muted mb-6">
        {t('dashboard.todaysSnapshot', { company: data?.companyName || company?.name })}
      </p>

      {loading && <Loading />}
      {error && <p className="text-sm text-danger">{error}</p>}

      {data && (
        <>
          {/* Company / branch selector, styled like the reference's bordered selector row.
              A single-branch company (the common case for a small vendor) gets a plain,
              non-interactive label: a chevron with no menu behind it would just be a
              trap. Multi-branch companies get a real dropdown to switch branch context. */}
          <div className="relative mb-6" ref={branchMenuRef}>
            <button
              type="button"
              onClick={() => hasMultipleBranches && setBranchMenuOpen((open) => !open)}
              className={`w-full flex items-center gap-3 bg-surface border border-rule-strong rounded-xl px-4 py-3 text-left ${
                hasMultipleBranches ? 'cursor-pointer hover:bg-surface-sunken' : 'cursor-default'
              }`}
              aria-haspopup={hasMultipleBranches ? 'menu' : undefined}
              aria-expanded={hasMultipleBranches ? branchMenuOpen : undefined}
            >
              <Building2 size={20} className="text-accent shrink-0" />
              <span className="flex-1 min-w-0 truncate">
                <span className="font-medium text-ink truncate">{data.companyName || company?.name}</span>
                {activeBranch && (
                  <span className="text-ink-muted"> &middot; {activeBranch.name}</span>
                )}
              </span>
              {hasMultipleBranches && <ChevronDown size={18} className="text-ink-muted shrink-0" />}
            </button>

            {hasMultipleBranches && branchMenuOpen && (
              <div
                role="menu"
                className="card absolute left-0 right-0 sm:right-auto sm:w-72 mt-1 z-20 py-1 max-h-72 overflow-y-auto"
              >
                {branches.map((branch) => (
                  <button
                    key={branch._id}
                    type="button"
                    role="menuitem"
                    onClick={() => selectBranch(branch._id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-ink hover:bg-surface-sunken"
                  >
                    <span className="w-4 shrink-0">
                      {branch._id === activeBranchId && <Check size={15} className="text-accent" />}
                    </span>
                    <span className="flex-1 truncate">{branch.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions: primary "New Sale" tile + secondary action tiles */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <Link
              to="/pos"
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-accent text-white p-6 shadow-sm hover:bg-accent-strong transition-colors"
            >
              <ShoppingCart size={28} />
              <span className="font-display font-semibold">{t('dashboard.newSale')}</span>
            </Link>
            <Link
              to="/products"
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surface border border-rule-strong text-accent p-6 hover:bg-surface-sunken transition-colors"
            >
              <PlusCircle size={28} />
              <span className="font-display font-semibold text-ink">{t('dashboard.addProduct')}</span>
            </Link>
            <Link
              to="/customers"
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surface border border-rule-strong text-accent p-6 hover:bg-surface-sunken transition-colors"
            >
              <Banknote size={28} />
              <span className="font-display font-semibold text-ink">{t('dashboard.bulkPayment')}</span>
            </Link>
            <Link
              to="/reports"
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surface border border-rule-strong text-accent p-6 hover:bg-surface-sunken transition-colors"
            >
              <CalendarClock size={28} />
              <span className="font-display font-semibold text-ink">{t('dashboard.appointment')}</span>
            </Link>
          </div>

          {/* CORE metrics: full-width bento cards like the reference's "Total Sales (Today)" */}
          <section className="mb-8">
            <p className="eyebrow mb-2">{t('dashboard.today')}</p>
            <div className="flex flex-col gap-3">
              <BigMetricCard
                icon={<TrendingUp size={20} />}
                label={t('dashboard.salesToday')}
                value={formatMoney(data.core.salesToday, company?.currency)}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label={t('dashboard.transactionsToday')} value={String(data.core.transactionsToday)} plain />
                <MetricCard
                  label={t('dashboard.lowStockItems')}
                  value={String(data.core.lowStockCount)}
                  plain
                  tone={data.core.lowStockCount > 0 ? 'warning' : undefined}
                />
                <MetricCard label={t('dashboard.cashAndBank')} value={formatMoney(data.core.cashAndBank, company?.currency)} />
                <MetricCard label={t('dashboard.receivablesDue')} value={formatMoney(data.core.receivablesDue, company?.currency)} />
              </div>
            </div>
          </section>

          {data.industry ? (
            <IndustrySection industry={data.industry} currency={company?.currency} />
          ) : (
            <p className="text-sm text-ink-muted mb-8">
              {t('dashboard.noIndustrySnapshot')}{' '}
              {t('dashboard.browseFullDetailUnder')} <Link to="/reports" className="underline">{t('dashboard.reports')}</Link>.
            </p>
          )}

          <div className="card p-4">
            <p className="text-sm font-medium mb-3">{t('dashboard.quickActions')}</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/pos" className="btn-primary">{t('dashboard.openCheckout')}</Link>
              <Link to="/reports" className="btn-secondary">{t('dashboard.reports')}</Link>
              <Link to="/customers" className="btn-secondary">{t('dashboard.customers')}</Link>
              <Link to="/dashboard/team" className="btn-secondary">{t('dashboard.teamDashboard')}</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Full-width metric card matching the reference's "Total Sales (Today)"
// bento tile: label + icon badge on top, big bold number below.
function BigMetricCard({ icon, label, value, sub, tone }) {
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm font-semibold text-ink-muted">{label}</span>
        <span className="p-2 rounded-lg bg-accent-soft text-accent">{icon}</span>
      </div>
      <p className={`font-display text-3xl sm:text-4xl font-bold ${tone === 'warning' ? 'text-warning' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-sm text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}

function IndustrySection({ industry, currency }) {
  const { t } = useTranslation();
  switch (industry.industry) {
    case 'pharmacy': return <PharmacySection s={industry} t={t} />;
    case 'hotel': return <HotelSection s={industry} t={t} />;
    case 'restaurant': return <RestaurantSection s={industry} t={t} />;
    case 'salon': return <SalonSection s={industry} t={t} />;
    case 'gym': return <GymSection s={industry} t={t} />;
    case 'real_estate': return <RealEstateSection s={industry} currency={currency} t={t} />;
    case 'grocery': return <GrocerySection s={industry} currency={currency} t={t} />;
    case 'retail': return <RetailSection s={industry} currency={currency} t={t} />;
    default: return null;
  }
}

function SectionTitle({ children }) {
  return <p className="eyebrow mb-2">{children}</p>;
}

function EmptyRow({ children }) {
  return <p className="text-sm text-ink-muted px-3 py-3">{children}</p>;
}

function SimpleTable({ columns, rows, empty }) {
  if (rows.length === 0) return <div className="card"><EmptyRow>{empty}</EmptyRow></div>;
  return (
    <div className="card overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
            {columns.map((c, i) => <th key={c} className={`px-3 py-2 font-medium whitespace-nowrap ${i > 0 ? 'text-right' : ''}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-rule last:border-0">
              {row.map((cell, j) => <td key={j} className={`px-3 py-2 whitespace-nowrap ${j > 0 ? 'num text-right' : ''}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PharmacySection({ s, t }) {
  return (
    <section className="mb-8">
      <SectionTitle>{t('dashboard.industry.pharmacy')}</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <MetricCard label={t('dashboard.nearExpiryBatches')} value={String(s.nearExpiryCount)} plain tone={s.nearExpiryCount > 0 ? 'warning' : undefined} />
        <MetricCard label={t('dashboard.pendingPrescriptions')} value={String(s.pendingPrescriptions)} plain tone={s.pendingPrescriptions > 0 ? 'warning' : undefined} />
      </div>
      <SimpleTable
        columns={[t('dashboard.product'), t('dashboard.batch'), t('dashboard.expiry'), t('dashboard.qtyOnHand'), t('dashboard.daysLeft')]}
        empty={t('dashboard.noBatchesExpiring30d')}
        rows={s.nearExpiryBatches.map((b) => [b.productName, b.batchNumber, formatDate(b.expiryDate), formatQty(b.quantityOnHand), b.daysToExpiry])}
      />
    </section>
  );
}

function HotelSection({ s, t }) {
  return (
    <section className="mb-8">
      <SectionTitle>{t('dashboard.industry.hotel')}</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <MetricCard label={t('dashboard.occupancy')} value={`${s.occupancyRate}%`} plain />
        <MetricCard label={t('dashboard.roomsOccupied')} value={`${s.occupiedRooms} / ${s.totalRooms}`} plain />
        <MetricCard label={t('dashboard.checkInsToday')} value={String(s.checkInsToday.length)} plain />
        <MetricCard label={t('dashboard.checkOutsToday')} value={String(s.checkOutsToday.length)} plain />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium mb-2">{t('dashboard.checkInsToday')}</p>
          <SimpleTable columns={[t('dashboard.room'), t('dashboard.guest')]} empty={t('dashboard.noCheckInsToday')}
            rows={s.checkInsToday.map((r) => [r.roomId?.roomNumber, r.guestName || r.customerId?.name || '-'])} />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">{t('dashboard.checkOutsToday')}</p>
          <SimpleTable columns={[t('dashboard.room'), t('dashboard.guest')]} empty={t('dashboard.noCheckOutsToday')}
            rows={s.checkOutsToday.map((r) => [r.roomId?.roomNumber, r.guestName || r.customerId?.name || '-'])} />
        </div>
      </div>
    </section>
  );
}

function RestaurantSection({ s, t }) {
  return (
    <section className="mb-8">
      <SectionTitle>{t('dashboard.industry.restaurant')}</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label={t('dashboard.openTables')} value={`${s.openTables} / ${s.totalTables}`} plain tone={s.openTables > 0 ? 'warning' : undefined} />
        <MetricCard label={t('dashboard.openKitchenTickets')} value={String(s.openKots)} plain tone={s.openKots > 0 ? 'warning' : undefined} />
        <MetricCard label={t('dashboard.ticketsToday')} value={String(s.kotsToday)} plain />
      </div>
    </section>
  );
}

function SalonSection({ s, t }) {
  return (
    <section className="mb-8">
      <SectionTitle>{t('dashboard.industry.salon')}</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <MetricCard label={t('dashboard.appointmentsToday')} value={String(s.appointmentsTodayCount)} plain />
        <MetricCard label={t('dashboard.completedToday')} value={String(s.appointmentsCompletedToday)} plain />
      </div>
      <SimpleTable
        columns={[t('dashboard.time'), t('dashboard.customer'), t('dashboard.service'), t('dashboard.status')]}
        empty={t('dashboard.noAppointmentsToday')}
        rows={s.appointmentsToday.map((a) => [formatDateTime(a.startTime), a.customerId?.name || '-', a.serviceName, a.status])}
      />
    </section>
  );
}

function GymSection({ s, t }) {
  return (
    <section className="mb-8">
      <SectionTitle>{t('dashboard.industry.gym')}</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <MetricCard label={t('dashboard.sessionsToday')} value={String(s.sessionsTodayCount)} plain />
        <MetricCard label={t('dashboard.enrolledCapacity')} value={`${s.totalEnrolled} / ${s.totalCapacity}`} plain />
        <MetricCard label={t('dashboard.waitlisted')} value={String(s.totalWaitlisted)} plain tone={s.totalWaitlisted > 0 ? 'warning' : undefined} />
      </div>
      <SimpleTable
        columns={[t('dashboard.time'), t('dashboard.class'), t('dashboard.enrolled'), t('dashboard.capacity')]}
        empty={t('dashboard.noClassesToday')}
        rows={s.sessionsToday.map((c) => [formatDateTime(c.startTime), c.gymClassId?.name, c.enrolledCustomerIds.length, c.capacity])}
      />
    </section>
  );
}

function RealEstateSection({ s, currency, t }) {
  return (
    <section className="mb-8">
      <SectionTitle>{t('dashboard.industry.realEstate')}</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <MetricCard label={t('dashboard.activeLeases')} value={String(s.activeLeaseCount)} plain />
        <MetricCard label={t('dashboard.overdueLeases')} value={String(s.overdueLeaseCount)} plain tone={s.overdueLeaseCount > 0 ? 'warning' : undefined} />
        <MetricCard label={t('dashboard.overdueRentTotal')} value={formatMoney(s.overdueTotal, currency)} tone={s.overdueTotal > 0 ? 'warning' : undefined} />
      </div>
      <SimpleTable
        columns={[t('dashboard.unit'), t('dashboard.tenant'), t('dashboard.dueDate'), t('dashboard.daysLate'), t('dashboard.amountDue')]}
        empty={t('dashboard.noOverdueRent')}
        rows={s.overdueLeases.map((l) => [l.unitNumber, l.tenantName || '-', formatDate(l.dueDate), l.daysLate, formatMoney(l.amountDue, currency)])}
      />
    </section>
  );
}

function GrocerySection({ s, currency, t }) {
  return (
    <section className="mb-8">
      <SectionTitle>{t('dashboard.industry.grocery')}</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium mb-2">{t('dashboard.fastMovers')}</p>
          <SimpleTable columns={[t('dashboard.product'), t('dashboard.revenue')]} empty={t('dashboard.noSalesLast7Days')}
            rows={s.fastMovers.map((p) => [p.productName, formatMoney(p.revenue, currency)])} />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">{t('dashboard.nearExpiryStock')}</p>
          <SimpleTable columns={[t('dashboard.product'), t('dashboard.batch'), t('dashboard.expiry'), t('dashboard.qty')]} empty={t('dashboard.nothingExpiring14Days')}
            rows={s.nearExpiryBatches.map((b) => [b.productName, b.batchNumber, formatDate(b.expiryDate), formatQty(b.quantityOnHand)])} />
        </div>
      </div>
    </section>
  );
}

function RetailSection({ s, currency, t }) {
  return (
    <section className="mb-8">
      <SectionTitle>{t('dashboard.industry.retail')}</SectionTitle>
      <p className="text-sm font-medium mb-2">{t('dashboard.topProductsToday')}</p>
      <SimpleTable columns={[t('dashboard.product'), t('dashboard.revenue')]} empty={t('dashboard.noSalesYetToday')}
        rows={s.topProductsToday.map((p) => [p.productName, formatMoney(p.revenue, currency)])} />
    </section>
  );
}
