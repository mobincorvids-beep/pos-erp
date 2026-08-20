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
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="page-title">Service orders</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>New job card</button>
        </div>
        {loading && <Loading />}
        {!loading && orders.length === 0 && (
          <EmptyState title="No job cards yet" description="Track repairs and service jobs — parts, labor, and billing." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Open a job card</button>} />
        )}
        {!loading && orders.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Labor</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id} onClick={() => setSelected(o)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === o._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-3 py-2">{o.itemDescription}</td>
                    <td className="px-3 py-2"><span className={STATUS_CHIP[o.status]}>{o.status.replace('_', ' ')}</span></td>
                    <td className="px-3 py-2 num text-right">{formatMoney(o.laborCharge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <p className="font-display text-lg mb-4">New job card</p>
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
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg">{order.itemDescription}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>

      <select className="field-input mb-4" value={order.status} onChange={(e) => updateStatus(e.target.value)}>
        <option value="received">Received</option>
        <option value="diagnosed">Diagnosed</option>
        <option value="in_progress">In progress</option>
        <option value="completed">Completed</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </select>

      <p className="text-sm font-medium mb-2">Parts used</p>
      <div className="space-y-1 text-sm mb-2">
        {order.partsUsed?.length === 0 && <p className="text-ink-muted text-xs">None yet.</p>}
        {order.partsUsed?.map((p, i) => (
          <div key={i} className="flex justify-between"><span className="text-ink-muted">× {p.quantity}</span><span className="num">{formatMoney(p.unitPrice * p.quantity, company?.currency)}</span></div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <select className="field-input col-span-2" value={partProductId} onChange={(e) => setPartProductId(e.target.value)}>
          <option value="">Add a part…</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <input type="number" min="1" className="field-input num" value={partQty} onChange={(e) => setPartQty(e.target.value)} />
      </div>
      <button className="btn-secondary w-full mb-4" disabled={!partProductId || busy} onClick={addPart}>Add part</button>

      <p className="text-sm font-medium mb-2">Labor charge</p>
      <div className="flex gap-2">
        <input type="number" className="field-input num" value={laborCharge} onChange={(e) => setLaborCharge(e.target.value)} />
        <button className="btn-secondary" onClick={saveLabor}>Save</button>
      </div>

      {order.status === 'completed' && (
        <p className="text-xs text-ink-muted mt-4">Billing (parts + labor as a single invoice) requires a company "Labor" service product and payment account — use the API's <code className="num">POST /service-orders/:id/bill</code> for now.</p>
      )}
    </div>
  );
}
