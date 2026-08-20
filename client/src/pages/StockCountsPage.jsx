import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatQty, formatDate } from '../lib/format';

export function StockCountsPage() {
  const toast = useToast();
  const [counts, setCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    api.get('/stock-counts').then(setCounts).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <p className="page-title mb-4">Stocktakes</p>
        {loading && <Loading />}
        {!loading && counts.length === 0 && <EmptyState title="No stocktakes yet" description="Start one via the API for a warehouse to reconcile physical vs system counts." />}
        {!loading && counts.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Count #</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <tr key={c._id} onClick={() => setSelected(c)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === c._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-3 py-2 num">{c.countNumber}</td>
                    <td className="px-3 py-2 text-ink-muted">{formatDate(c.createdAt)}</td>
                    <td className="px-3 py-2"><span className="chip-neutral">{c.status.replace('_', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <StockCountPanel count={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function StockCountPanel({ count, onClose, onChanged }) {
  const toast = useToast();
  const [counted, setCounted] = useState(() => Object.fromEntries(count.items.map((i) => [i._id, i.countedQuantity ?? ''])));
  const [busy, setBusy] = useState(false);

  async function saveCounts() {
    setBusy(true);
    try {
      await api.patch(`/stock-counts/${count._id}/counts`, {
        counts: Object.entries(counted).filter(([, v]) => v !== '').map(([itemId, countedQuantity]) => ({ itemId, countedQuantity: Number(countedQuantity) })),
      });
      toast('Counts saved.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true);
    try {
      await api.post(`/stock-counts/${count._id}/submit`);
      toast('Stocktake submitted — variances posted as adjustments.', 'success');
      onChanged();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg num">{count.countNumber}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto mb-3">
        {count.items.map((item) => (
          <div key={item._id} className="flex items-center justify-between text-sm gap-2">
            <span className="text-ink-muted num">System: {formatQty(item.systemQuantity)}</span>
            <input
              type="number" className="field-input num w-24" placeholder="Counted"
              value={counted[item._id]} onChange={(e) => setCounted({ ...counted, [item._id]: e.target.value })}
              disabled={count.status !== 'in_progress'}
            />
          </div>
        ))}
      </div>

      {count.status === 'in_progress' && (
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" disabled={busy} onClick={saveCounts}>Save counts</button>
          <button className="btn-primary flex-1" disabled={busy} onClick={submit}>Submit</button>
        </div>
      )}
    </div>
  );
}
