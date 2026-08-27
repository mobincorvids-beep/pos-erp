import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const { company, can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="page-title mb-1">Good day</p>
      <p className="text-sm text-ink-muted mb-6">Here's what's relevant to you at {company?.name}.</p>

      {loading && <Loading />}
      {error && <p className="text-sm text-danger">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <MetricCard label="Unread notifications" value={String(data.unreadNotifications)} plain tone={data.unreadNotifications > 0 ? 'warning' : undefined} />
            <MetricCard label="Pending approvals" value={String(data.pendingApprovals)} plain tone={data.pendingApprovals > 0 ? 'warning' : undefined} />
            <MetricCard label="Pending expenses" value={String(data.pendingExpenses)} plain />
            <MetricCard label="Open stock counts" value={String(data.openStockCounts)} plain />
          </div>

          {data.sections.owner && <OwnerSection s={data.sections.owner} currency={company?.currency} />}
          {data.sections.salesManager && <SalesManagerSection s={data.sections.salesManager} currency={company?.currency} />}
          {data.sections.warehouseManager && <WarehouseManagerSection s={data.sections.warehouseManager} currency={company?.currency} />}
          {data.sections.hrManager && <HrManagerSection s={data.sections.hrManager} />}
          {data.sections.cashier && <CashierSection s={data.sections.cashier} currency={company?.currency} />}
        </>
      )}

      <div className="card p-4 mt-6">
        <p className="text-sm font-medium mb-3">Quick actions</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/pos" className="btn-primary">Open checkout</Link>
          {can('purchases.create') && <Link to="/purchases" className="btn-secondary">New purchase order</Link>}
          <Link to="/customers" className="btn-secondary">Customers</Link>
          <Link to="/reports" className="btn-secondary">Reports</Link>
        </div>
      </div>
    </div>
  );
}

function OwnerSection({ s, currency }) {
  return (
    <section className="mb-8">
      <p className="eyebrow mb-2">Business overview (last 30 days)</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Revenue" value={formatMoney(s.revenue, currency)} />
        <MetricCard label="Net profit" value={formatMoney(s.netProfit, currency)} tone={s.netProfit < 0 ? 'warning' : undefined} />
        <MetricCard label="Receivables" value={formatMoney(s.receivables, currency)} />
        <MetricCard label="Payables" value={formatMoney(s.payables, currency)} />
        <MetricCard label="Cash & bank" value={formatMoney(s.cashAndBank, currency)} />
        <MetricCard label="Inventory value" value={formatMoney(s.inventoryValue, currency)} />
        <MetricCard label="Sales (30d)" value={formatMoney(s.salesTotal30d, currency)} />
        <MetricCard label="Invoices (30d)" value={String(s.salesCount30d)} plain />
      </div>
    </section>
  );
}

function SalesManagerSection({ s, currency }) {
  return (
    <section className="mb-8">
      <p className="eyebrow mb-2">Sales (last 30 days)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-sm font-medium mb-3">Top products</p>
          {s.topProducts.length === 0 && <p className="text-sm text-ink-muted">No sales yet.</p>}
          {s.topProducts.map((p) => (
            <div key={p.productId} className="flex justify-between text-sm border-b border-rule last:border-0 py-1.5">
              <span>{p.productName}</span>
              <span className="num">{formatMoney(p.revenue, currency)}</span>
            </div>
          ))}
        </div>
        <div className="card p-4">
          <p className="text-sm font-medium mb-3">Top customers</p>
          {s.topCustomers.length === 0 && <p className="text-sm text-ink-muted">No sales yet.</p>}
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
  return (
    <section className="mb-8">
      <p className="eyebrow mb-2">Inventory</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <MetricCard label="Low stock items" value={String(s.lowStockCount)} plain tone={s.lowStockCount > 0 ? 'warning' : undefined} />
        <MetricCard label="Inventory value" value={formatMoney(s.inventoryValue, currency)} />
      </div>
      {s.lowStockItems.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-medium mb-3">Needs reordering</p>
          {s.lowStockItems.map((item, i) => (
            <div key={i} className="flex justify-between text-sm border-b border-rule last:border-0 py-1.5">
              <span>{item.productName}</span>
              <span className="num text-warning">{item.quantityOnHand} on hand</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HrManagerSection({ s }) {
  return (
    <section className="mb-8">
      <p className="eyebrow mb-2">HR</p>
      <MetricCard label="Pending leave requests" value={String(s.pendingLeaveRequests)} plain tone={s.pendingLeaveRequests > 0 ? 'warning' : undefined} />
    </section>
  );
}

function CashierSection({ s, currency }) {
  return (
    <section className="mb-8">
      <p className="eyebrow mb-2">Today</p>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Sales today" value={formatMoney(s.salesTotalToday, currency)} />
        <MetricCard label="Transactions today" value={String(s.saleCountToday)} plain />
      </div>
    </section>
  );
}
