import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

export function StockTransfersPage() {
  const toast = useToast();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/stock-transfers').then(setTransfers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function receive(id) {
    try {
      await api.post(`/stock-transfers/${id}/receive`);
      toast('Transfer received.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <p className="page-title mb-4">Stock transfers</p>

      {loading && <Loading />}
      {!loading && transfers.length === 0 && (
        <EmptyState title="No transfers yet" description="Move stock between warehouses via the API — a full create-transfer form isn't in this UI yet." />
      )}
      {!loading && transfers.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Items</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2 text-ink-muted">{formatDate(t.createdAt)}</td>
                  <td className="px-3 py-2 num">{t.items.reduce((s, i) => s + i.quantity, 0)} units, {t.items.length} line(s)</td>
                  <td className="px-3 py-2"><span className="chip-neutral">{t.status.replace('_', ' ')}</span></td>
                  <td className="px-3 py-2 text-right">
                    {t.status === 'in_transit' && <button className="btn-ghost !text-accent" onClick={() => receive(t._id)}>Mark received</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
