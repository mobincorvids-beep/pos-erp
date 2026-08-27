import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { Loading } from '../../components/Loading';
import { formatMoney } from '../../lib/format';

export function AdminOverviewPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.get('/admin/dashboard/overview').then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <Loading />;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="page-title mb-1">Platform overview</p>
          <p className="text-sm text-ink-muted">Consolidated metrics across every tenant company, last 30 days.</p>
        </div>
        <span className="chip-accent shrink-0">Last 30 days</span>
      </div>

      <div className="card p-5 mb-6">
        <p className="text-sm font-semibold text-ink mb-4">Consolidated financials</p>
        <div className="grid grid-cols-4 gap-3">
          <Metric label="Companies" value={String(data.totalCompanies)} sub={`${data.activeCompanies} active, ${data.suspendedCompanies} suspended`} plain />
          <Metric label="Users" value={String(data.totalUsers)} plain />
          <Metric label="Platform net sales" value={formatMoney(data.platformNetSales)} />
          <Metric label="Invoices" value={String(data.platformInvoiceCount)} plain />
        </div>
      </div>

      <div className="card p-5">
        <p className="text-sm font-semibold text-ink mb-3">Companies by industry</p>
        {data.byIndustry.length === 0 ? (
          <p className="text-sm text-ink-muted">No companies onboarded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data.byIndustry.map((row) => (
                <tr key={row.industryType} className="border-b border-rule last:border-0">
                  <td className="py-2 capitalize text-ink">{row.industryType.replace('_', ' ')}</td>
                  <td className="py-2 text-right num text-ink">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, sub, plain }) {
  return (
    <div className="rounded-lg border border-rule bg-surface-sunken p-4">
      <p className="eyebrow mb-1">{label}</p>
      <p className={`text-2xl ${plain ? 'font-display font-bold' : 'num font-semibold'} text-ink`}>{value}</p>
      {sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}
