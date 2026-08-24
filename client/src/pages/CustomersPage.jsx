import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit

  function load() {
    setLoading(true);
    api.get('/customers').then(setCustomers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="page-title">Customers</p>
          <button className="btn-primary" onClick={() => setEditing({})}>New customer</button>
        </div>

        {loading && <Loading />}
        {!loading && customers.length === 0 && (
          <EmptyState title="No customers yet" description="Add customers to track credit sales and loyalty." action={<button className="btn-primary" onClick={() => setEditing({})}>Add a customer</button>} />
        )}

        {!loading && customers.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Tags</th>
                  <th className="px-3 py-2 font-medium text-right">Loyalty pts</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id} className={`border-b border-rule last:border-0 hover:bg-paper ${selected?._id === c._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-3 py-2 cursor-pointer" onClick={() => setSelected(c)}>{c.name}</td>
                    <td className="px-3 py-2 num text-ink-muted cursor-pointer" onClick={() => setSelected(c)}>{c.phone || '—'}</td>
                    <td className="px-3 py-2 cursor-pointer" onClick={() => setSelected(c)}>{c.tags?.map((t) => <span key={t} className="chip-neutral mr-1">{t}</span>)}</td>
                    <td className="px-3 py-2 num text-right cursor-pointer" onClick={() => setSelected(c)}>{c.loyaltyPoints}</td>
                    <td className="px-3 py-2 text-right"><button className="btn-ghost !text-ink-muted !px-2 text-xs" onClick={() => setEditing(c)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <CustomerLedgerPanel customer={selected} onClose={() => setSelected(null)} />}
      {editing !== null && <CustomerForm customer={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function CustomerForm({ customer, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !customer._id;
  const [form, setForm] = useState({
    name: customer.name || '', phone: customer.phone || '', email: customer.email || '',
    address: customer.address || '', creditLimit: customer.creditLimit ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, creditLimit: Number(form.creditLimit) || 0 };
      if (isNew) {
        await api.post('/customers', payload);
        toast('Customer added.', 'success');
      } else {
        await api.put(`/customers/${customer._id}`, payload);
        toast('Customer updated.', 'success');
      }
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
        <p className="font-display text-lg mb-4">{isNew ? 'New customer' : 'Edit customer'}</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Phone</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="field-label">Email</label><input type="email" className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="field-label">Address</label><input className="field-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><label className="field-label">Credit limit</label><input type="number" className="field-input num" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function CustomerLedgerPanel({ customer, onClose }) {
  const { company } = useAuth();
  const toast = useToast();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    api.get(`/customers/${customer._id}/ledger`).then(setLedger).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(() => { load(); api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {}); }, [customer._id]);

  async function recordPayment() {
    if (!paymentAmount || !paymentAccountId) return;
    setBusy(true);
    try {
      await api.post(`/customers/${customer._id}/payments`, { amount: Number(paymentAmount), paymentAccountId, date: new Date().toISOString() });
      toast('Payment recorded.', 'success');
      setPaymentAmount('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg">{customer.name}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>

      {loading && <Loading />}
      {ledger && (
        <>
          <div className="space-y-1.5 text-sm max-h-64 overflow-y-auto mb-3">
            {ledger.entries.length === 0 && <p className="text-ink-muted">No transactions yet.</p>}
            {ledger.entries.map((e, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-ink-muted">{formatDate(e.date)} — {e.type === 'sale' ? `Inv ${e.reference}` : e.type === 'sale_payment' ? `Paid at sale ${e.reference}` : 'Payment'}</span>
                <span className={`num ${e.type === 'sale' ? 'text-ink' : 'text-accent-strong'}`}>
                  {e.type === 'sale' ? '+' : '−'}{formatMoney(e.type === 'sale' ? e.debit : e.credit, company?.currency)}
                </span>
              </div>
            ))}
          </div>
          <div className="tear-line my-2" />
          <div className="flex justify-between text-base font-medium mb-4">
            <span>Balance owed</span>
            <span className={`num ${ledger.closingBalance > 0 ? 'text-warning' : 'text-accent-strong'}`}>{formatMoney(ledger.closingBalance, company?.currency)}</span>
          </div>

          <p className="text-sm font-medium mb-2">Record a payment</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="number" placeholder="Amount" className="field-input num" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            <select className="field-input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
              <option value="">Account…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn-primary w-full" disabled={busy || !paymentAmount || !paymentAccountId} onClick={recordPayment}>
            {busy ? 'Recording…' : 'Record payment'}
          </button>
          <p className="text-xs text-ink-muted mt-2">Auto-allocated against the oldest unpaid invoices first.</p>

          <div className="tear-line my-3" />
          <LoyaltyRedeem customer={customer} />
        </>
      )}
    </div>
  );
}

function LoyaltyRedeem({ customer }) {
  const toast = useToast();
  const [points, setPoints] = useState('');
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);

  async function redeem() {
    if (!points) return;
    setBusy(true);
    try {
      const result = await api.post(`/loyalty/customers/${customer._id}/redeem`, { points: Number(points) });
      setQuote(result);
      toast(`Reserved — apply as a discount at checkout.`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium mb-1">Redeem loyalty points</p>
      <p className="text-xs text-ink-muted mb-2">{customer.loyaltyPoints} points available. Quotes a discount value and reserves the points — apply it manually to the item lines at checkout (Sale has no header-level discount).</p>
      <div className="flex gap-2">
        <input type="number" min="1" max={customer.loyaltyPoints} placeholder="Points" className="field-input num" value={points} onChange={(e) => setPoints(e.target.value)} />
        <button className="btn-secondary" disabled={busy || !points} onClick={redeem}>{busy ? 'Quoting…' : 'Quote'}</button>
      </div>
      {quote && (
        <p className="text-sm mt-2">Discount value: <span className="num text-accent-strong">{quote.discountValue}</span> for {quote.points} points.</p>
      )}
    </div>
  );
}
