import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useToast } from '../../components/Toast';
import { Loading } from '../../components/Loading';
import { EmptyState } from '../../components/EmptyState';
import { formatDateTime } from '../../lib/format';

export function AdminAuditLogPage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState('');

  function load() {
    setLoading(true);
    const query = entityType ? `?entityType=${entityType}` : '';
    adminApi.get(`/admin/audit-logs${query}`).then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [entityType]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Audit log</p>
        <select className="field-input w-56" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">All entity types</option>
          <option value="Company">Company</option>
          <option value="User">User</option>
          <option value="Expense">Expense</option>
          <option value="PurchaseOrder">Purchase order</option>
          <option value="Sale">Sale</option>
          <option value="Voucher">Voucher</option>
          <option value="StockCount">Stock count</option>
        </select>
      </div>

      {loading && <Loading />}
      {!loading && rows.length === 0 && <EmptyState title="No activity recorded yet" />}
      {!loading && rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Entity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2 text-ink-muted">{formatDateTime(r.createdAt)}</td>
                  <td className="px-3 py-2">{r.companyId?.name || '—'}</td>
                  <td className="px-3 py-2 num">{r.action}</td>
                  <td className="px-3 py-2 text-ink-muted">{r.entityType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
