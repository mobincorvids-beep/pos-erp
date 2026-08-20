import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatQty, formatDateTime } from '../lib/format';

const STATUS_OPTIONS = [
  ['', 'All statuses'],
  ['open', 'Open'],
  ['closed', 'Closed'],
];

export function BakeryPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [closing, setClosing] = useState(null);

  function load() {
    setLoading(true);
    const qs = status ? `?status=${status}` : '';
    api.get(`/bakery/batches${qs}`).then(setBatches).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [status]);

  return (
    <div>
      <p className="page-title mb-4">Bakery</p>
      <div className="flex justify-between items-center mb-3 gap-2">
        <select className="field-input w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Produce batch</button>
      </div>

      {loading && <Loading />}
      {!loading && batches.length === 0 && (
        <EmptyState
          title="No production batches yet"
          description="Record a same-day production run to start tracking expiry and end-of-day waste write-off."
          action={<button className="btn-primary" onClick={() => setShowForm(true)}>Produce a batch</button>}
        />
      )}
      {!loading && batches.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Produced</th>
                <th className="px-3 py-2 font-medium">Wasted</th>
                <th className="px-3 py-2 font-medium">Waste value</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Produced at</th>
                <th className="px-3 py-2 font-medium">Closed at</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{b.productId?.name || b.productId}</td>
                  <td className="px-3 py-2 num">{formatQty(b.producedQuantity)}</td>
                  <td className="px-3 py-2 num">{formatQty(b.wastedQuantity)}</td>
                  <td className="px-3 py-2 num">{formatMoney(b.wasteValue, company?.currency)}</td>
                  <td className="px-3 py-2"><span className={b.status === 'open' ? 'chip-warning' : 'chip-neutral'}>{b.status}</span></td>
                  <td className="px-3 py-2 text-ink-muted">{formatDateTime(b.producedDate)}</td>
                  <td className="px-3 py-2 text-ink-muted">{formatDateTime(b.closedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {b.status === 'open' && (
                      <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setClosing(b)}>Close batch</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ProduceBatchForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {closing && <CloseBatchModal batch={closing} onClose={() => setClosing(null)} onClosed={() => { setClosing(null); load(); }} />}
    </div>
  );
}

function ProduceBatchForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', productId: '', variantId: '', producedQuantity: '', unitCost: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  const selectedProduct = products.find((p) => p._id === form.productId);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!form.variantId) throw new Error('Select a product with a variant.');
      await api.post('/bakery/batches', {
        branchId: form.branchId,
        warehouseId: form.warehouseId,
        productId: form.productId,
        variantId: form.variantId,
        producedQuantity: Number(form.producedQuantity),
        unitCost: Number(form.unitCost) || 0,
      });
      toast('Batch produced.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Produce batch</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, warehouseId: '' })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Product</label>
            <select
              required
              className="field-input"
              value={form.productId}
              onChange={(e) => {
                const product = products.find((p) => p._id === e.target.value);
                setForm({ ...form, productId: e.target.value, variantId: product?.variants?.[0]?._id || '' });
              }}
            >
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          {selectedProduct && selectedProduct.variants?.length > 1 && (
            <div>
              <label className="field-label">Variant</label>
              <select required className="field-input" value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })}>
                {selectedProduct.variants.map((v) => <option key={v._id} value={v._id}>{v.name || v.sku}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Produced quantity</label><input type="number" step="any" required className="field-input num" value={form.producedQuantity} onChange={(e) => setForm({ ...form, producedQuantity: e.target.value })} /></div>
            <div><label className="field-label">Unit cost</label><input type="number" step="any" className="field-input num" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function CloseBatchModal({ batch, onClose, onClosed }) {
  const { company } = useAuth();
  const toast = useToast();
  const [closingNow, setClosingNow] = useState(false);

  async function handleClose() {
    setClosingNow(true);
    try {
      const result = await api.post(`/bakery/batches/${batch._id}/close`);
      const wasted = Number(result.wastedQuantity || 0);
      toast(
        wasted > 0
          ? `Batch closed — ${formatQty(wasted)} unsold units written off (${formatMoney(result.wasteValue, company?.currency)}).`
          : 'Batch closed — nothing left unsold.',
        'success'
      );
      onClosed();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setClosingNow(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-1">Close batch</p>
        <p className="text-sm text-ink-muted mb-4">
          Produced <span className="num">{formatQty(batch.producedQuantity)}</span> of{' '}
          <span className="font-medium">{batch.productId?.name || 'this product'}</span>. Closing the day checks how much is still
          on hand, writes off whatever remains as end-of-day waste, and posts the expense automatically — this can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" disabled={closingNow} className="btn-primary" onClick={handleClose}>{closingNow ? 'Closing…' : 'Close batch'}</button>
        </div>
      </div>
    </div>
  );
}
