import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/Loading';
import { formatMoney, toDateInputValue } from '../lib/format';

export function DashboardPage() {
  const { company, can } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const to = toDateInputValue();
    const from = toDateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    api.get(`/reports/sales-summary?from=${from}&to=${to}`)
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="page-title mb-1">Good day</p>
      <p className="text-sm text-ink-muted mb-6">Here's how the last 30 days looked for {company?.name}.</p>

      {loading && <Loading />}
      {error && <p className="text-sm text-danger">{error}</p>}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Net sales (30d)" value={formatMoney(summary.summary.netSales, company?.currency)} />
          <StatCard label="Invoices" value={String(summary.summary.invoiceCount)} plain />
          <StatCard label="Outstanding dues" value={formatMoney(summary.summary.totalDue, company?.currency)} tone="warning" />
          <StatCard label="Discounts given" value={formatMoney(summary.summary.totalDiscount, company?.currency)} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-sm font-medium mb-3">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/pos" className="btn-primary">Open checkout</Link>
            {can('purchases.create') && <Link to="/purchases" className="btn-secondary">New purchase order</Link>}
            <Link to="/customers" className="btn-secondary">Customers</Link>
            <Link to="/reports" className="btn-secondary">Reports</Link>
          </div>
        </div>

        <div className="card p-4">
          <p className="text-sm font-medium mb-3">Sales by payment method (30d)</p>
          {summary?.byPaymentMethod?.length ? (
            <table className="w-full text-sm">
              <tbody>
                {summary.byPaymentMethod.map((row) => (
                  <tr key={row.method} className="border-b border-rule last:border-0">
                    <td className="py-1.5 capitalize">{row.method.replace('_', ' ')}</td>
                    <td className="py-1.5 text-right num">{formatMoney(row.total, company?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-ink-muted">No sales recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone, plain }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-muted mb-1">{label}</p>
      <p className={`text-xl ${plain ? 'font-display' : 'num'} ${tone === 'warning' ? 'text-warning' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  );
}
