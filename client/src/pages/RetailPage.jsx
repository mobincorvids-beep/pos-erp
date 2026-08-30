import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function RetailPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [paying, setPaying] = useState(null);
  const [editing, setEditing] = useState(null);
  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [paymentAccountId, setPaymentAccountId] = useState('');

  function load() {
    setLoading(true);
    api.get('/retail/layaway').then(setPlans).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }
  useEffect(load, []);

  async function pay(e) {
    e.preventDefault();
    try {
      const result = await api.post(`/retail/layaway/${paying._id}/payments`, { amount: Number(amount), paymentAccountId });
      toast(result.completed ? 'Payment complete (plan fulfilled!' : `Payment recorded) ${formatMoney(result.remaining, company?.currency)} remaining.`, 'success');
      setPaying(null); setAmount('');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Retail</p>
          <p className="page-title">Layaway Plans</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-base leading-none">add</span>
          New plan
        </button>
      </div>

      {loading && <Loading />}
      {!loading && plans.length === 0 && (
        <EmptyState title="No layaway plans yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Start one</button>} />
      )}
      {!loading && plans.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-widest">
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold text-right">Paid / Total</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{p.productId?.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{p.customerId?.name}</td>
                  <td className="px-4 py-3 num text-right">
                    {formatMoney(p.amountPaid, company?.currency)}
                    <span className="text-ink-muted"> / {formatMoney(p.totalPrice, company?.currency)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.status === 'completed' ? 'chip-accent' : p.status === 'cancelled' ? 'chip-danger' : 'chip-neutral'}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {p.status === 'active' && p.amountPaid === 0 && <button className="btn-ghost !text-accent" onClick={() => setEditing(p)}>Edit</button>}
                    {p.status === 'active' && <button className="btn-ghost !text-accent" onClick={() => setPaying(p)}>Pay</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <PlanForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <PlanEditForm plan={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {paying && (
        <div className="fixed inset-0 bg-ink/30 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
          <form onSubmit={pay} className="card p-6 w-full max-w-xs">
            <p className="font-display text-lg font-semibold text-ink mb-4">Record payment</p>
            <div className="space-y-3">
              <div>
                <label className="field-label">Amount</label>
                <input type="number" required placeholder="0.00" className="field-input num" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Payment account</label>
                <select required className="field-input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                  <option value="">Select account…</option>
                  {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-secondary" onClick={() => setPaying(null)}>Cancel</button>
              <button type="submit" className="btn-primary">Pay</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PlanEditForm({ plan, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ totalPrice: plan.totalPrice, quantity: plan.quantity || 1 });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/retail/layaway/${plan._id}`, { totalPrice: Number(form.totalPrice), quantity: Number(form.quantity) });
      toast('Plan updated.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-xs">
        <p className="font-display text-lg font-semibold text-ink mb-4">Edit plan: {plan.productId?.name}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Total price</label>
            <input type="number" required className="field-input num" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Quantity</label>
            <input type="number" min="1" required className="field-input num" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
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

function PlanForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', productId: '', customerId: '', totalPrice: '', depositLiabilityAccountId: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); api.get('/products').then(setProducts).catch(() => {}); api.get('/customers').then(setCustomers).catch(() => {}); api.get('/org/accounts?type=liability').then(setAccounts).catch(() => {}); }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.productId);
      await api.post('/retail/layaway', { ...form, variantId: product?.variants[0]?._id, totalPrice: Number(form.totalPrice) });
      toast('Layaway plan opened.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-semibold text-ink mb-4">New layaway plan</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select branch…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Item</label>
            <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">Select item…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Total price</label>
            <input type="number" required placeholder="0.00" className="field-input num" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Deposit liability account</label>
            <select required className="field-input" value={form.depositLiabilityAccountId} onChange={(e) => setForm({ ...form, depositLiabilityAccountId: e.target.value })}>
              <option value="">Select account…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Opening…' : 'Open plan'}</button>
        </div>
      </form>
    </div>
  );
}
