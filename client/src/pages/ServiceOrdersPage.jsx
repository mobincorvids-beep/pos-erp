import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const STATUS_CHIP = { received: 'chip-neutral', diagnosed: 'chip-info', in_progress: 'chip-warning', completed: 'chip-accent', delivered: 'chip-accent', cancelled: 'chip-danger' };

export function ServiceOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/service-orders').then(setOrders).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow mb-1">Warranty &amp; service</p>
            <p className="page-title">Service job cards</p>
            <p className="text-sm text-ink-muted mt-1">Track repairs, parts consumption, and labor billing.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>New job card</button>
        </div>

        {loading && <Loading />}
        {!loading && orders.length === 0 && (
          <EmptyState title="No job cards yet" description="Track repairs and service jobs — parts, labor, and billing." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Open a job card</button>} />
        )}
        {!loading && orders.length > 0 && (
          <div className="card flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
              <p className="font-display text-lg font-semibold text-ink">Job orders</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-rule bg-surface-sunken/60">
                    <th className="px-5 py-3 eyebrow font-medium">Item</th>
                    <th className="px-5 py-3 eyebrow font-medium">Status</th>
                    <th className="px-5 py-3 eyebrow font-medium text-right">Labor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {orders.map((o) => (
                    <tr
                      key={o._id}
                      onClick={() => setSelected(o)}
                      className={`group cursor-pointer transition-colors hover:bg-accent-soft/30 ${selected?._id === o._id ? 'bg-accent-soft/40' : ''}`}
                    >
                      <td className="px-5 py-4 font-medium text-ink group-hover:text-accent transition-colors">{o.itemDescription}</td>
                      <td className="px-5 py-4"><span className={STATUS_CHIP[o.status]}>{o.status.replace('_', ' ')}</span></td>
                      <td className="px-5 py-4 num text-right text-ink-muted">{formatMoney(o.laborCharge)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {selected && <ServiceOrderPanel order={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <ServiceOrderForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ServiceOrderForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ itemDescription: '', reportedIssue: '', branchId: '', warehouseId: '', customerId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/service-orders', { ...form, customerId: form.customerId || undefined });
      toast('Job card opened.', 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-4">New job card</p>
        <div className="space-y-3">
          <div><label className="field-label">Item / description</label><input required autoFocus className="field-input" value={form.itemDescription} onChange={(e) => setForm({ ...form, itemDescription: e.target.value })} placeholder="e.g. iPhone 12 — screen repair" /></div>
          <div><label className="field-label">Reported issue</label><input className="field-input" value={form.reportedIssue} onChange={(e) => setForm({ ...form, reportedIssue: e.target.value })} /></div>
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse (for parts)</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Walk-in</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Opening…' : 'Open job card'}</button>
        </div>
      </form>
    </div>
  );
}

function ServiceOrderPanel({ order, onClose, onChanged }) {
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [partProductId, setPartProductId] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [laborCharge, setLaborCharge] = useState(order.laborCharge || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  async function updateStatus(status) {
    try {
      await api.patch(`/service-orders/${order._id}/status`, { status });
      toast('Status updated.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function addPart() {
    const product = products.find((p) => p._id === partProductId);
    if (!product) return;
    setBusy(true);
    try {
      await api.post(`/service-orders/${order._id}/parts`, {
        productId: product._id, variantId: product.variants[0]?._id,
        quantity: Number(partQty), unitPrice: product.sellingPrice,
      });
      toast('Part added and drawn from inventory.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function saveLabor() {
    try {
      await api.patch(`/service-orders/${order._id}/labor-charge`, { laborCharge: Number(laborCharge) || 0 });
      toast('Labor charge saved.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4 h-fit">
      <div className="card overflow-hidden">
        <div className="bg-surface-sunken/60 px-5 py-4 border-b border-rule flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-ink truncate pr-2">{order.itemDescription}</p>
          <button className="text-ink-muted hover:text-ink text-sm shrink-0" onClick={onClose}>Close</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="field-label">Status</label>
            <select className="field-input" value={order.status} onChange={(e) => updateStatus(e.target.value)}>
              <option value="received">Received</option>
              <option value="diagnosed">Diagnosed</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="p-4 rounded-lg bg-surface-sunken border border-rule relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
            <p className="field-label mb-2">Parts used</p>
            <div className="space-y-1 text-sm mb-1">
              {order.partsUsed?.length === 0 && <p className="text-ink-muted text-xs">None yet.</p>}
              {order.partsUsed?.map((p, i) => (
                <div key={i} className="flex justify-between"><span className="text-ink-muted">× {p.quantity}</span><span className="num text-ink">{formatMoney(p.unitPrice * p.quantity, company?.currency)}</span></div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select className="field-input col-span-2" value={partProductId} onChange={(e) => setPartProductId(e.target.value)}>
              <option value="">Add a part…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            <input type="number" min="1" className="field-input num" value={partQty} onChange={(e) => setPartQty(e.target.value)} />
          </div>
          <button className="btn-secondary w-full" disabled={!partProductId || busy} onClick={addPart}>Add part</button>

          <div>
            <label className="field-label">Labor charge</label>
            <div className="flex gap-2">
              <input type="number" className="field-input num" value={laborCharge} onChange={(e) => setLaborCharge(e.target.value)} />
              <button className="btn-secondary" onClick={saveLabor}>Save</button>
            </div>
          </div>

          {order.status === 'completed' && (
            <p className="text-xs text-ink-muted pt-2 border-t border-rule">Billing (parts + labor as a single invoice) requires a company "Labor" service product and payment account — use the API's <code className="num">POST /service-orders/:id/bill</code> for now.</p>
          )}
        </div>
      </div>
    </div>
  );
}
