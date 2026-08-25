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
      toast(result.completed ? 'Payment complete — plan fulfilled!' : `Payment recorded — ${formatMoney(result.remaining, company?.currency)} remaining.`, 'success');
      setPaying(null); setAmount('');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Layaway Plans</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New plan</button>
      </div>
      {loading && <Loading />}
      {!loading && plans.length === 0 && <EmptyState title="No layaway plans yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Start one</button>} />}
      {!loading && plans.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide"><th className="px-3 py-2 font-medium">Item</th><th className="px-3 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium text-right">Paid / Total</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium"></th></tr></thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{p.productId?.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{p.customerId?.name}</td>
                  <td className="px-3 py-2 num text-right">{formatMoney(p.amountPaid, company?.currency)} / {formatMoney(p.totalPrice, company?.currency)}</td>
                  <td className="px-3 py-2"><span className={p.status === 'completed' ? 'chip-accent' : p.status === 'cancelled' ? 'chip-danger' : 'chip-neutral'}>{p.status}</span></td>
                  <td className="px-3 py-2 text-right space-x-2">
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
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
          <form onSubmit={pay} className="card p-5 w-full max-w-xs">
            <p className="font-display text-lg mb-4">Record payment</p>
            <input type="number" required placeholder="Amount" className="field-input num mb-3" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select required className="field-input mb-4" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}><option value="">Payment account…</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
            <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setPaying(null)}>Cancel</button><button type="submit" className="btn-primary">Pay</button></div>
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
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs">
        <p className="font-display text-lg mb-4">Edit plan — {plan.productId?.name}</p>
        <div className="space-y-3">
          <div><label className="field-label">Total price</label><input type="number" required className="field-input num" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} /></div>
          <div><label className="field-label">Quantity</label><input type="number" min="1" required className="field-input num" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button></div>
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
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">New layaway plan</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Branch…</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select>
          <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}><option value="">Warehouse…</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
          <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}><option value="">Item…</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
          <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Customer…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
          <input type="number" required placeholder="Total price" className="field-input num" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} />
          <select required className="field-input" value={form.depositLiabilityAccountId} onChange={(e) => setForm({ ...form, depositLiabilityAccountId: e.target.value })}><option value="">Liability account…</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Opening…' : 'Open plan'}</button></div>
      </form>
    </div>
  );
}
