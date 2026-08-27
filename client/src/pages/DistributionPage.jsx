import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function DistributionPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showOrder, setShowOrder] = useState(false);

  function load() {
    setLoading(true);
    api.get('/distribution/price-schedules').then(setSchedules).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <p className="page-title">Supply Chain &amp; Distribution</p>
          <p className="text-sm text-ink-muted mt-1">Tiered price schedules and wholesale sales orders.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn-secondary" onClick={() => setShowOrder(true)}>Create wholesale order</button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>New price schedule</button>
        </div>
      </div>

      <div className="card p-5">
        <p className="eyebrow mb-3">Tiered price schedules</p>
        {loading && <Loading />}
        {!loading && schedules.length === 0 && <EmptyState title="No tiered price schedules yet" description="Set quantity-based pricing per product." />}
        {!loading && schedules.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {schedules.map((s) => (
              <div key={s._id} className="rounded-lg border border-rule bg-paper p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-ink">{s.productId?.name || 'Product'}</p>
                  <span className="chip-neutral">MOQ {s.minimumOrderQuantity}</span>
                </div>
                <div className="tear-line mt-2 pt-2 space-y-1">
                  {s.tiers.map((t, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-ink-muted">{t.minQuantity}+ units</span>
                      <span className="num text-ink">{formatMoney(t.unitPrice, company?.currency)}/unit</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showForm && <ScheduleForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {showOrder && <OrderForm onClose={() => setShowOrder(false)} />}
    </div>
  );
}

function ScheduleForm({ onClose, onSaved }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [minimumOrderQuantity, setMinimumOrderQuantity] = useState(1);
  const [tiers, setTiers] = useState([{ minQuantity: '', unitPrice: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  function updateTier(i, patch) {
    setTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === productId);
      if (!product) throw new Error('Select a product.');
      await api.post('/distribution/price-schedules', {
        productId, variantId: product.variants[0]?._id, minimumOrderQuantity: Number(minimumOrderQuantity),
        tiers: tiers.filter((t) => t.minQuantity && t.unitPrice).map((t) => ({ minQuantity: Number(t.minQuantity), unitPrice: Number(t.unitPrice) })),
      });
      toast('Price schedule saved.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">New price schedule</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="field-label">Product</label>
            <select required className="field-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Minimum order quantity</label><input type="number" min="1" className="field-input num" value={minimumOrderQuantity} onChange={(e) => setMinimumOrderQuantity(e.target.value)} /></div>
        </div>

        <p className="field-label mb-2">Tiers (ascending quantity)</p>
        <div className="space-y-2 mb-2">
          {tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="Min qty" className="field-input num" value={t.minQuantity} onChange={(e) => updateTier(i, { minQuantity: e.target.value })} />
              <input type="number" placeholder="Unit price" className="field-input num" value={t.unitPrice} onChange={(e) => updateTier(i, { unitPrice: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-5" onClick={() => setTiers([...tiers, { minQuantity: '', unitPrice: '' }])}>+ Add tier</button>

        <div className="flex justify-end gap-2 pt-3 border-t border-rule">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function OrderForm({ onClose }) {
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', customerId: '', productId: '', quantity: '' });
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function getQuote() {
    const product = products.find((p) => p._id === form.productId);
    if (!product || !form.quantity) return;
    setQuoting(true);
    try {
      const [q] = await api.post('/distribution/quote', { items: [{ productId: product._id, variantId: product.variants[0]?._id, quantity: Number(form.quantity) }] });
      setQuote(q);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setQuoting(false);
    }
  }

  async function createOrder() {
    const product = products.find((p) => p._id === form.productId);
    setSaving(true);
    try {
      const order = await api.post('/distribution/sales-orders', {
        branchId: form.branchId, warehouseId: form.warehouseId, customerId: form.customerId,
        items: [{ productId: product._id, variantId: product.variants[0]?._id, quantity: Number(form.quantity) }],
      });
      toast(`Sales order created at ${formatMoney(order.totalAmount, company?.currency)}.`, 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <div className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">Create wholesale order</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="field-label">Branch</label>
            <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Product</label>
              <select className="field-input" value={form.productId} onChange={(e) => { setForm({ ...form, productId: e.target.value }); setQuote(null); }}>
                <option value="">Select…</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="field-label">Quantity</label><input type="number" className="field-input num" value={form.quantity} onChange={(e) => { setForm({ ...form, quantity: e.target.value }); setQuote(null); }} /></div>
          </div>
        </div>
        <button type="button" className="btn-secondary w-full mb-4" disabled={!form.productId || !form.quantity || quoting} onClick={getQuote}>
          {quoting ? 'Quoting…' : 'Get tiered quote'}
        </button>
        {quote && (
          <div className="tear-line pt-3 mb-4 flex justify-between text-base font-medium text-ink">
            <span>{quote.unitPrice}/unit {quote.tierApplied && <span className="text-xs text-ink-muted font-normal">(tier {quote.tierApplied}+)</span>}</span>
            <span className="num text-accent-strong">{formatMoney(quote.lineTotal, company?.currency)}</span>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t border-rule">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" disabled={!quote || !form.branchId || !form.warehouseId || !form.customerId || saving} className="btn-primary" onClick={createOrder}>
            {saving ? 'Creating…' : 'Create sales order'}
          </button>
        </div>
      </div>
    </div>
  );
}
