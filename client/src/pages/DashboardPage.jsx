import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/Loading';
import { MetricCard } from '../components/MetricCard';
import { formatMoney } from '../lib/format';

// Role-aware — the sections rendered come straight from the Dashboard
// Engine's own routing (dashboardService.getDashboard), not decided here.
// A cashier and an owner hitting this same page genuinely see different
// data, because the SERVER decided what to send back based on their real
// permissions, not because the client hid something it already had.
export function DashboardPage() {
  const { t } = useTranslation();
  const { company, can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="page-title mb-1">{t('dashboard.goodDay')}</p>
      <p className="text-sm text-ink-muted mb-6">{t('dashboard.relevantAt', { company: company?.name })}</p>

      {loading && <Loading />}
      {error && <p className="text-sm text-danger">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <MetricCard label={t('dashboard.unreadNotifications')} value={String(data.unreadNotifications)} plain tone={data.unreadNotifications > 0 ? 'warning' : undefined} />
            <MetricCard label={t('dashboard.pendingApprovals')} value={String(data.pendingApprovals)} plain tone={data.pendingApprovals > 0 ? 'warning' : undefined} />
            <MetricCard label={t('dashboard.pendingExpenses')} value={String(data.pendingExpenses)} plain />
            <MetricCard label={t('dashboard.openStockCounts')} value={String(data.openStockCounts)} plain />
          </div>

          {data.sections.owner && <OwnerSection s={data.sections.owner} currency={company?.currency} />}
          {data.sections.salesManager && <SalesManagerSection s={data.sections.salesManager} currency={company?.currency} />}
          {data.sections.warehouseManager && <WarehouseManagerSection s={data.sections.warehouseManager} currency={company?.currency} />}
          {data.sections.hrManager && <HrManagerSection s={data.sections.hrManager} />}
          {data.sections.cashier && <CashierSection s={data.sections.cashier} currency={company?.currency} />}
        </>
      )}

      <div className="card p-4 mt-6">
        <p className="text-sm font-medium mb-3">{t('dashboard.quickActions')}</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/pos" className="btn-primary">{t('dashboard.openCheckout')}</Link>
          {can('purchases.create') && <Link to="/purchases" className="btn-secondary">{t('dashboard.newPurchaseOrder')}</Link>}
          <Link to="/customers" className="btn-secondary">{t('dashboard.customers')}</Link>
          <Link to="/reports" className="btn-secondary">{t('dashboard.reports')}</Link>
        </div>
      </div>
    </div>
  );
}

function OwnerSection({ s, currency }) {
  const { t } = useTranslation();
  return (
    <section className="mb-8">
      <p className="eyebrow mb-2">{t('dashboard.businessOverview')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label={t('dashboard.revenue')} value={formatMoney(s.revenue, currency)} />
        <MetricCard label={t('dashboard.netProfit')} value={formatMoney(s.netProfit, currency)} tone={s.netProfit < 0 ? 'warning' : undefined} />
        <MetricCard label={t('dashboard.receivables')} value={formatMoney(s.receivables, currency)} />
        <MetricCard label={t('dashboard.payables')} value={formatMoney(s.payables, currency)} />
        <MetricCard label={t('dashboard.cashAndBank')} value={formatMoney(s.cashAndBank, currency)} />
        <MetricCard label={t('dashboard.inventoryValue')} value={formatMoney(s.inventoryValue, currency)} />
        <MetricCard label={t('dashboard.sales30d')} value={formatMoney(s.salesTotal30d, currency)} />
        <MetricCard label={t('dashboard.invoices30d')} value={String(s.salesCount30d)} plain />
      </div>
    </section>
  );
}

function SalesManagerSection({ s, currency }) {
  const { t } = useTranslation();
  return (
    <section className="mb-8">
      <p className="eyebrow mb-2">{t('dashboard.salesLast30Days')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-sm font-medium mb-3">{t('dashboard.topProducts')}</p>
          {s.topProducts.length === 0 && <p className="text-sm text-ink-muted">{t('dashboard.noSalesYet')}</p>}
          {s.topProducts.map((p) => (
            <div key={p.productId} className="flex justify-between text-sm border-b border-rule last:border-0 py-1.5">
              <span>{p.productName}</span>
              <span className="num">{formatMoney(p.revenue, currency)}</span>
            </div>
          ))}
        </div>
        <div className="card p-4">
          <p className="text-sm font-medium mb-3">{t('dashboard.topCustomers')}</p>
          {s.topCustomers.length === 0 && <p className="text-sm text-ink-muted">{t('dashboard.noSalesYet')}</p>}
          {s.topCustomers.map((c) => (
            <div key={c.customerId} className="flex justify-between text-sm border-b border-rule last:border-0 py-1.5">
              <span>{c.customerName}</span>
              <span className="num">{formatMoney(c.totalSpend, currency)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WarehouseManagerSection({ s, currency }) {
  const { t } = useTranslation();
  return (
    <section className="mb-8">
      <p className="eyebrow mb-2">{t('dashboard.inventory')}</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <MetricCard label={t('dashboard.lowStockItems')} value={String(s.lowStockCount)} plain tone={s.lowStockCount > 0 ? 'warning' : undefined} />
        <MetricCard label={t('dashboard.inventoryValue')} value={formatMoney(s.inventoryValue, currency)} />
      </div>
      {s.lowStockItems.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-medium mb-3">{t('dashboard.needsReordering')}</p>
          {s.lowStockItems.map((item, i) => (
            <div key={i} className="flex justify-between text-sm border-b border-rule last:border-0 py-1.5">
              <span>{item.productName}</span>
              <span className="num text-warning">{t('dashboard.onHand', { qty: item.quantityOnHand })}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HrManagerSection({ s }) {
  const { t } = useTranslation();
  return (
    <section className="mb-8">
      <p className="eyebrow mb-2">{t('dashboard.hr')}</p>
      <MetricCard label={t('dashboard.pendingLeaveRequests')} value={String(s.pendingLeaveRequests)} plain tone={s.pendingLeaveRequests > 0 ? 'warning' : undefined} />
    </section>
  );
}

function CashierSection({ s, currency }) {
  const { t } = useTranslation();
  return (
    <section className="mb-8">
      <p className="eyebrow mb-2">{t('dashboard.today')}</p>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label={t('dashboard.salesToday')} value={formatMoney(s.salesTotalToday, currency)} />
        <MetricCard label={t('dashboard.transactionsToday')} value={String(s.saleCountToday)} plain />
      </div>
    </section>
  );
}
