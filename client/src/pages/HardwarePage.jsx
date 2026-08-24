import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function HardwarePage() {
  const { company } = useAuth();
  const toast = useToast();
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [returning, setReturning] = useState(null);

  function load() {
    setLoading(true);
    api.get('/hardware/rentals').then(setRentals).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleVoid(r) {
    if (!window.confirm(`Void this rental for ${r.customerId?.name}? Restocks the item and reverses the deposit — use this for a mistaken checkout, not a real return.`)) return;
    try {
      await api.post(`/hardware/rentals/${r._id}/void`);
      toast('Rental voided.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex justify-end mb-3"><button className="btn-primary" onClick={() => setShowForm(true)}>Check out rental</button></div>
        {loading && <Loading />}
        {!loading && rentals.length === 0 && <EmptyState title="No rentals yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Check out a tool</button>} />}
        {!loading && rentals.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide"><th className="px-3 py-2 font-medium">Item</th><th className="px-3 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium"></th></tr></thead>
              <tbody>
                {rentals.map((r) => (
                  <tr key={r._id} className="border-b border-rule last:border-0">
                    <td className="px-3 py-2">{r.productId?.name}</td>
                    <td className="px-3 py-2 text-ink-muted">{r.customerId?.name}</td>
                    <td className="px-3 py-2"><span className={r.status === 'out' ? 'chip-warning' : 'chip-accent'}>{r.status}</span></td>
                    <td className="px-3 py-2 text-right">
                      {r.status === 'out' && <button className="btn-ghost !text-accent !px-2" onClick={() => setReturning(r)}>Return</button>}
                      {r.status === 'out' && <button className="btn-ghost !text-danger !px-2" onClick={() => handleVoid(r)}>Void</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showForm && <RentalForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {returning && <ReturnForm rental={returning} onClose={() => setReturning(null)} onReturned={() => { setReturning(null); load(); }} />}
    </div>
  );
}

function RentalForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', productId: '', customerId: '', dailyRate: '', depositAmount: '', expectedReturnDate: '', depositReceivedInAccountId: '', depositLiabilityAccountId: '', rentalBillingProductId: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.productId);
      const billingProduct = products.find((p) => p._id === form.rentalBillingProductId);
      await api.post('/hardware/rentals', {
        ...form, variantId: product?.variants[0]?._id, rentalBillingVariantId: billingProduct?.variants[0]?._id,
        dailyRate: Number(form.dailyRate), depositAmount: Number(form.depositAmount),
      });
      toast('Rental checked out.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">Check out rental</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Branch…</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select>
          <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}><option value="">Warehouse…</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
          <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}><option value="">Item to rent…</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
          <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Customer…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" required placeholder="Daily rate" className="field-input num" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} />
            <input type="number" required placeholder="Deposit" className="field-input num" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} />
          </div>
          <input type="date" required className="field-input" value={form.expectedReturnDate} onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })} />
          <select required className="field-input" value={form.depositReceivedInAccountId} onChange={(e) => setForm({ ...form, depositReceivedInAccountId: e.target.value })}><option value="">Deposit received into…</option>{accounts.filter((a) => a.isPaymentAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
          <select required className="field-input" value={form.depositLiabilityAccountId} onChange={(e) => setForm({ ...form, depositLiabilityAccountId: e.target.value })}><option value="">Deposit liability account…</option>{accounts.filter((a) => a.type === 'liability').map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
          <select required className="field-input" value={form.rentalBillingProductId} onChange={(e) => setForm({ ...form, rentalBillingProductId: e.target.value })}><option value="">Usage billing product (service)…</option>{products.filter((p) => p.trackingMode === 'service').map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Checking out…' : 'Check out'}</button></div>
      </form>
    </div>
  );
}

function ReturnForm({ rental, onClose, onReturned }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [condition, setCondition] = useState('good');
  const [finalPaymentAccountId, setFinalPaymentAccountId] = useState('');
  const [forfeitPercentForMinorDamage, setForfeitPercentForMinorDamage] = useState(50);
  const [damageRevenueAccountId, setDamageRevenueAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { condition, finalPaymentAccountId };
      if (condition !== 'good') { payload.damageRevenueAccountId = damageRevenueAccountId; payload.forfeitPercentForMinorDamage = Number(forfeitPercentForMinorDamage); }
      await api.post(`/hardware/rentals/${rental._id}/return`, payload);
      toast('Returned.', 'success');
      onReturned();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Return rental</p>
        <div className="space-y-3">
          <select className="field-input" value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="good">Good — full refund</option>
            <option value="minor_damage">Minor damage — partial forfeit</option>
            <option value="lost_or_major_damage">Lost / major damage — full forfeit</option>
          </select>
          {condition === 'minor_damage' && <input type="number" placeholder="Forfeit %" className="field-input num" value={forfeitPercentForMinorDamage} onChange={(e) => setForfeitPercentForMinorDamage(e.target.value)} />}
          {condition !== 'good' && <select required className="field-input" value={damageRevenueAccountId} onChange={(e) => setDamageRevenueAccountId(e.target.value)}><option value="">Damage revenue account…</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>}
          <select required className="field-input" value={finalPaymentAccountId} onChange={(e) => setFinalPaymentAccountId(e.target.value)}><option value="">Final payment account…</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Processing…' : 'Return'}</button></div>
      </form>
    </div>
  );
}
