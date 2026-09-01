import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { ordered: 'chip-neutral', in_production: 'chip-warning', ready: 'chip-accent', delivered: 'chip-accent', cancelled: 'chip-danger' };

export function FurniturePage() {
  const { company } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rate, setRate] = useState(null);

  function load() {
    setLoading(true);
    api.get('/furniture/orders').then(setOrders).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
    api.get('/furniture/on-time-delivery-rate').then(setRate).catch(() => {});
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <p className="eyebrow mb-1">Furniture</p>
          <p className="page-title">Custom orders</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New custom order</button>
      </div>
      {rate && rate.totalDelivered > 0 && (
        <div className="card p-4 mb-5 inline-block">
          <p className="eyebrow mb-1">On-time delivery rate</p>
          <p className="font-display text-3xl num text-ink">{rate.onTimeRate}%</p>
          <p className="text-xs text-ink-muted mt-1">{rate.onTimeCount} on time / {rate.lateCount} late of {rate.totalDelivered}</p>
        </div>
      )}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {loading && <Loading />}
          {!loading && orders.length === 0 && <EmptyState title="No custom orders yet" />}
          {!loading && orders.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Promised</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o._id} onClick={() => setSelected(o)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === o._id ? 'bg-accent-soft/40' : ''}`}>
                        <td className="px-4 py-3 text-ink">{o.description}</td>
                        <td className="px-4 py-3 text-ink-muted">{o.customerId?.name}</td>
                        <td className="px-4 py-3 text-ink-muted num">{formatDate(o.promisedDeliveryDate)}</td>
                        <td className="px-4 py-3"><span className={STATUS_CHIP[o.status]}>{o.status.replace('_', ' ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {selected && <OrderPanel order={selected} onClose={() => setSelected(null)} onChanged={load} />}
      </div>
      {showForm && <OrderForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function OrderForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ branchId: '', customerId: '', description: '', promisedDeliveryDate: '', price: '', depositAmount: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price) };
      if (form.depositAmount) payload.depositAmount = Number(form.depositAmount); else delete payload.depositAmount;
      await api.post('/furniture/orders', payload);
      toast('Order placed.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg text-ink mb-4">New custom order</p>
        <div className="space-y-3">
          <div><label className="field-label">Branch</label><select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Select…</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></div>
          <div><label className="field-label">Customer</label><select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Select…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
          <div><label className="field-label">Description</label><input className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="field-label">Promised delivery date</label><input type="date" required className="field-input" value={form.promisedDeliveryDate} onChange={(e) => setForm({ ...form, promisedDeliveryDate: e.target.value })} /></div>
          <div><label className="field-label">Price</label><input type="number" required className="field-input num" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div><label className="field-label">Deposit (optional)</label><input type="number" className="field-input num" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Place order'}</button></div>
      </form>
    </div>
  );
}

function OrderPanel({ order, onClose, onChanged }) {
  const toast = useToast();
  const [boms, setBoms] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [bomId, setBomId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/manufacturing/boms').then(setBoms).catch(() => {});
    if (order.branchId) api.get(`/org/warehouses?branchId=${order.branchId}`).then(setWarehouses).catch(() => {});
  }, [order._id]);

  async function startProduction() {
    setBusy(true);
    try {
      await api.post(`/furniture/orders/${order._id}/start-production`, { bomId, warehouseId });
      toast('Production started.', 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function markReady() {
    setBusy(true);
    try {
      await api.post(`/furniture/orders/${order._id}/mark-ready`);
      toast('Marked ready.', 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function deliver() {
    setBusy(true);
    try {
      await api.post(`/furniture/orders/${order._id}/deliver`, { warehouseId });
      toast('Delivered and billed.', 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-lg text-ink">{order.description}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>
      <div className="mb-4"><span className={STATUS_CHIP[order.status]}>{order.status.replace('_', ' ')}</span></div>
      {order.status === 'ordered' && (
        <>
          <label className="field-label">Bill of materials</label>
          <select className="field-input mb-2" value={bomId} onChange={(e) => setBomId(e.target.value)}><option value="">BOM…</option>{boms.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select>
          <label className="field-label">Warehouse</label>
          <select className="field-input mb-3" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}><option value="">Warehouse…</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
          <button className="btn-primary w-full" disabled={!bomId || !warehouseId || busy} onClick={startProduction}>Start production</button>
        </>
      )}
      {order.status === 'in_production' && <button className="btn-primary w-full" disabled={busy} onClick={markReady}>Mark ready (requires production completed via Manufacturing page)</button>}
      {order.status === 'ready' && (
        <>
          <label className="field-label">Warehouse</label>
          <select className="field-input mb-3" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}><option value="">Warehouse…</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
          <button className="btn-primary w-full" disabled={!warehouseId || busy} onClick={deliver}>Deliver & bill</button>
        </>
      )}
      {order.status === 'delivered' && <p className="text-sm text-accent-strong">Delivered.</p>}
    </div>
  );
}
