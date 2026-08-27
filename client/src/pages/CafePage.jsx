import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';
import { Plus, X } from 'lucide-react';

const STATUS_CHIP = { active: 'chip-accent' };

export function CafePage() {
  const toast = useToast();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/cafe/subscriptions').then(setSubs).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function redeem(id, warehouseId) {
    try {
      await api.post(`/cafe/subscriptions/${id}/redeem`, { warehouseId });
      toast('Redeemed!', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function cancelSub(s) {
    if (!window.confirm(`Cancel ${s.customerId?.name}'s "${s.planName}" subscription? This stops today onward, the sale record isn't affected.`)) return;
    try {
      await api.post(`/cafe/subscriptions/${s._id}/cancel`);
      toast('Subscription cancelled.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="eyebrow mb-1">Cafe</p>
          <p className="page-title">Subscriptions</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Sell subscription
        </button>
      </div>

      {loading && <Loading />}
      {!loading && subs.length === 0 && (
        <EmptyState title="No subscriptions yet" description="Sell a subscription plan to start tracking daily redemptions." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Sell one</button>} />
      )}
      {!loading && subs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {subs.map((s) => (
            <div key={s._id} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-display text-base font-semibold text-ink">{s.planName}</p>
                <span className={s.status === 'active' ? STATUS_CHIP.active : 'chip-neutral'}>{s.status}</span>
              </div>
              <p className="text-xs text-ink-muted">{s.customerId?.name}</p>
              <p className="text-xs text-ink-muted mb-3">Until {formatDate(s.endDate)}</p>
              <div className="flex flex-wrap gap-3 items-center">
                {s.status === 'active' && <RedeemButton subscription={s} onRedeem={redeem} />}
                {s.status === 'active' && <button className="text-xs font-semibold text-danger hover:opacity-80" onClick={() => cancelSub(s)}>Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && <SubForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function RedeemButton({ subscription, onRedeem }) {
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => { api.get('/org/warehouses').then(setWarehouses).catch(() => {}); }, []);
  return (
    <button
      className="text-xs font-semibold text-accent hover:text-accent-strong disabled:opacity-40 disabled:pointer-events-none"
      onClick={() => onRedeem(subscription._id, warehouses[0]?._id)}
      disabled={!warehouses.length}
    >
      Redeem today
    </button>
  );
}

function SubForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', customerId: '', planName: '', startDate: '', endDate: '', dailyLimit: 1, subscriptionBillingProductId: '', subscriptionPrice: '', redeemProductId: '', paymentAccountId: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const billingProduct = products.find((p) => p._id === form.subscriptionBillingProductId);
      const redeemProduct = products.find((p) => p._id === form.redeemProductId);
      await api.post('/cafe/subscriptions', {
        ...form, subscriptionBillingVariantId: billingProduct?.variants[0]?._id, redeemVariantId: redeemProduct?.variants[0]?._id,
        dailyLimit: Number(form.dailyLimit), subscriptionPrice: Number(form.subscriptionPrice),
      });
      toast('Subscription sold.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg font-semibold text-ink">Sell subscription</p>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Branch…</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Warehouse…</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Customer…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Plan name</label>
            <input required placeholder="e.g. Daily Coffee Pass" className="field-input" value={form.planName} onChange={(e) => setForm({ ...form, planName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Start date</label>
              <input type="date" required className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">End date</label>
              <input type="date" required className="field-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Daily redemption limit</label>
            <input type="number" placeholder="Daily redemption limit" className="field-input num" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Subscription fee product (service)</label>
            <select required className="field-input" value={form.subscriptionBillingProductId} onChange={(e) => setForm({ ...form, subscriptionBillingProductId: e.target.value })}>
              <option value="">Subscription fee product (service)…</option>{products.filter((p) => p.trackingMode === 'service').map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Subscription price</label>
            <input type="number" required placeholder="Subscription price" className="field-input num" value={form.subscriptionPrice} onChange={(e) => setForm({ ...form, subscriptionPrice: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Redeems daily</label>
            <select required className="field-input" value={form.redeemProductId} onChange={(e) => setForm({ ...form, redeemProductId: e.target.value })}>
              <option value="">What they redeem daily…</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Payment account</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">Payment account…</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Selling…' : 'Sell'}</button>
        </div>
      </form>
    </div>
  );
}
