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
      <p className="page-title mb-1">Platform overview</p>
      <p className="text-sm text-ink-muted mb-6">Across every tenant company, last 30 days.</p>

      <div className="grid grid-cols-4 gap-3 mb-8">
        <Metric label="Companies" value={String(data.totalCompanies)} sub={`${data.activeCompanies} active, ${data.suspendedCompanies} suspended`} plain />
        <Metric label="Users" value={String(data.totalUsers)} plain />
        <Metric label="Platform net sales" value={formatMoney(data.platformNetSales)} />
        <Metric label="Invoices" value={String(data.platformInvoiceCount)} plain />
      </div>

      <div className="card p-4">
        <p className="text-sm font-medium mb-3">Companies by industry</p>
        {data.byIndustry.length === 0 ? (
          <p className="text-sm text-ink-muted">No companies onboarded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data.byIndustry.map((row) => (
                <tr key={row.industryType} className="border-b border-rule last:border-0">
                  <td className="py-1.5 capitalize">{row.industryType.replace('_', ' ')}</td>
                  <td className="py-1.5 text-right num">{row.count}</td>
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
    <div className="card p-4">
      <p className="text-xs text-ink-muted mb-1">{label}</p>
      <p className={`text-xl ${plain ? 'font-display' : 'num'} text-ink`}>{value}</p>
      {sub && <p className="text-xs text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}
