import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function BakeryPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/bakery/batches').then(setBatches).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function closeBatch(id) {
    try {
      const result = await api.post(`/bakery/batches/${id}/close`);
      toast(result.wastedQuantity > 0 ? `Closed — ${result.wastedQuantity} units written off (${formatMoney(result.wasteValue, company?.currency)}).` : 'Closed — nothing wasted.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="eyebrow mb-1">Bakery operations</p>
          <p className="page-title">Daily batches</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          Log production
        </button>
      </div>
      {loading && <Loading />}
      {!loading && batches.length === 0 && <EmptyState title="No batches logged yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Log one</button>} />}
      {!loading && batches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((b) => (
            <div key={b._id} className="card p-4">
              <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-accent text-base">bakery_dining</span>
                {b.productId?.name}
              </p>
              <p className="text-xs text-ink-muted mb-2">Produced {b.producedQuantity}</p>
              <div className="flex items-center justify-between">
                <span className={b.status === 'closed' ? 'chip-neutral' : 'chip-accent'}>{b.status}</span>
                {b.status === 'open' && <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => closeBatch(b._id)}>Close day</button>}
              </div>
              {b.status === 'closed' && b.wastedQuantity > 0 && (
                <p className="text-xs text-danger mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">delete</span>
                  {b.wastedQuantity} wasted — {formatMoney(b.wasteValue, company?.currency)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {showForm && <BatchForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function BatchForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', productId: '', producedQuantity: '', unitCost: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); api.get('/products').then(setProducts).catch(() => {}); }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.productId);
      await api.post('/bakery/batches', { ...form, variantId: product?.variants[0]?._id, producedQuantity: Number(form.producedQuantity), unitCost: Number(form.unitCost) || 0 });
      toast('Batch logged.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-accent">bakery_dining</span>
          Log production
        </p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
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
            <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Quantity</label><input type="number" required className="field-input num" value={form.producedQuantity} onChange={(e) => setForm({ ...form, producedQuantity: e.target.value })} /></div>
            <div><label className="field-label">Unit cost</label><input type="number" className="field-input num" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></div>
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
