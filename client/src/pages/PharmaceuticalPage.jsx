import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { open: 'chip-warning', closed: 'chip-accent' };

export function PharmaceuticalPage() {
  const toast = useToast();
  const [recalls, setRecalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  function load() {
    setLoading(true);
    api.get('/pharmaceutical/recalls').then(setRecalls).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const openCount = recalls.filter((r) => r.status === 'open').length;

  return (
    <div>
      <div className="flex items-end justify-between mb-1">
        <div>
          <p className="page-title">Batch recalls</p>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">Every customer who received this batch is traced directly from real sales history the moment a recall starts — not a manual list someone has to compile.</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowForm(true)}>
          <span className="icon text-base leading-none">add</span>
          Initiate a recall
        </button>
      </div>

      {!loading && recalls.length > 0 && (
        <div className="flex items-center gap-2 mt-4 mb-5">
          <span className="chip-neutral">{recalls.length} total</span>
          {openCount > 0 && <span className="chip-warning">{openCount} open</span>}
        </div>
      )}

      {loading && <div className="mt-5"><Loading /></div>}
      {!loading && recalls.length === 0 && (
        <div className="mt-5">
          <EmptyState title="No recalls" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Initiate one</button>} />
        </div>
      )}
      {!loading && recalls.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-sunken text-ink-muted border-b border-rule">
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Reason</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Initiated</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {recalls.map((r) => (
                <tr key={r._id} className="hover:bg-accent-soft/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{r.productId?.name || '—'}</td>
                  <td className="px-4 py-3 text-ink-muted max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3 num text-ink-muted">{formatDate(r.initiatedDate)}</td>
                  <td className="px-4 py-3"><span className={STATUS_CHIP[r.status]}>{r.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost !text-accent" onClick={() => setSelectedId(r._id)}>Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <RecallForm onClose={() => setShowForm(false)} onSaved={(id) => { setShowForm(false); load(); setSelectedId(id); }} />}
      {selectedId && <RecallDetail recallId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
    </div>
  );
}

function RecallForm({ onClose, onSaved }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [productId, setProductId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);
  useEffect(() => { if (productId) api.get(`/products/batches?productId=${productId}`).then(setBatches).catch(() => {}); }, [productId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post('/pharmaceutical/recalls', { productId, batchId, reason });
      toast(`Recall initiated — ${result.affectedCustomers.length} customer(s) traced from real sales history.`, 'success');
      onSaved(result._id);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">Initiate a recall</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Product</label>
            <select required className="field-input" value={productId} onChange={(e) => { setProductId(e.target.value); setBatchId(''); }}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Batch</label>
            <select required className="field-input" value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!productId}>
              <option value="">Select…</option>
              {batches.map((b) => <option key={b._id} value={b._id}>{b.batchNumber} {b.expiryDate ? `(expires ${formatDate(b.expiryDate)})` : ''}</option>)}
            </select>
            {productId && batches.length === 0 && <p className="text-xs text-ink-muted mt-1">No batches on file for this product.</p>}
          </div>
          <div><label className="field-label">Reason</label><textarea required rows={3} className="field-input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Initiating…' : 'Initiate recall'}</button>
        </div>
      </form>
    </div>
  );
}

function RecallDetail({ recallId, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [returningFor, setReturningFor] = useState(null);
  const [returnQty, setReturnQty] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/pharmaceutical/recalls/${recallId}`).then(setData).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [recallId]);

  async function recordReturn(customerId) {
    setBusy(true);
    try {
      await api.post(`/pharmaceutical/recalls/${recallId}/returns`, { customerId, quantity: Number(returnQty) });
      toast('Return recorded.', 'success');
      setReturningFor(null);
      setReturnQty('');
      load(); onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function close() {
    setBusy(true);
    try {
      await api.post(`/pharmaceutical/recalls/${recallId}/close`, {});
      toast('Recall closed.', 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  if (!data) return null;
  const { recall, progress } = data;

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <p className="font-display text-lg font-bold text-ink">{recall.productId?.name}</p>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <p className="text-sm text-ink-muted mb-4">{recall.reason}</p>

        <div className="rounded-lg bg-surface-sunken p-4 mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-ink">{progress.percentComplete}% recovered</p>
            <p className="text-xs text-ink-muted num">{progress.totalReturned} of {progress.totalSold} units</p>
          </div>
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${progress.percentComplete}%` }} />
          </div>
        </div>

        <p className="eyebrow mb-2">Affected customers ({recall.affectedCustomers.length})</p>
        <div className="card overflow-hidden mb-3">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-sunken text-ink-muted border-b border-rule">
                <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Customer</th>
                <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Sold</th>
                <th className="px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Returned</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {recall.affectedCustomers.map((c) => {
                const remaining = c.quantitySold - c.quantityReturned;
                return (
                  <tr key={c.customerId?._id || c.customerId} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="px-4 py-2.5 text-ink">{c.customerId?.name || '—'}</td>
                    <td className="px-4 py-2.5 num text-right">{c.quantitySold}</td>
                    <td className="px-4 py-2.5 num text-right">{c.quantityReturned}</td>
                    <td className="px-4 py-2.5 text-right">
                      {remaining > 0 && recall.status === 'open' && (
                        returningFor === (c.customerId?._id || c.customerId) ? (
                          <div className="flex gap-1 justify-end items-center">
                            <input type="number" min="1" max={remaining} className="field-input !py-1 !text-xs !w-16" value={returnQty} onChange={(e) => setReturnQty(e.target.value)} />
                            <button className="btn-ghost !text-accent" disabled={busy} onClick={() => recordReturn(c.customerId?._id || c.customerId)}>Save</button>
                          </div>
                        ) : (
                          <button className="btn-ghost !text-accent" onClick={() => setReturningFor(c.customerId?._id || c.customerId)}>Record return</button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {recall.status === 'open' && <button className="btn-secondary" disabled={busy} onClick={close}>Close recall</button>}
      </div>
    </div>
  );
}
