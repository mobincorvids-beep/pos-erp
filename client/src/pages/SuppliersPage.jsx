import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function SuppliersPage() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/suppliers').then(setSuppliers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="page-title">Suppliers</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>New supplier</button>
        </div>

        {loading && <Loading />}
        {!loading && suppliers.length === 0 && (
          <EmptyState title="No suppliers yet" description="Add suppliers to track purchases and payables." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add a supplier</button>} />
        )}
        {!loading && suppliers.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s._id} onClick={() => setSelected(s)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === s._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2 num text-ink-muted">{s.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <SupplierLedgerPanel supplier={selected} onClose={() => setSelected(null)} />}
      {showForm && <SupplierForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function SupplierForm({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/suppliers', form);
      toast('Supplier added.', 'success');
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
        <p className="font-display text-lg mb-4">New supplier</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Phone</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function SupplierLedgerPanel({ supplier, onClose }) {
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
    api.get(`/suppliers/${supplier._id}/ledger`).then(setLedger).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(() => { load(); api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {}); }, [supplier._id]);

  async function recordPayment() {
    if (!paymentAmount || !paymentAccountId) return;
    setBusy(true);
    try {
      await api.post(`/suppliers/${supplier._id}/payments`, { amount: Number(paymentAmount), paymentAccountId, date: new Date().toISOString() });
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
        <p className="font-display text-lg">{supplier.name}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>

      {loading && <Loading />}
      {ledger && (
        <>
          <div className="space-y-1.5 text-sm max-h-64 overflow-y-auto mb-3">
            {ledger.entries.length === 0 && <p className="text-ink-muted">No transactions yet.</p>}
            {ledger.entries.map((e, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-ink-muted">{formatDate(e.date)} — {e.type === 'purchase' ? `PO ${e.reference}` : e.type === 'purchase_payment' ? `Paid at receiving ${e.reference}` : 'Payment'}</span>
                <span className={`num ${e.type === 'purchase' ? 'text-ink' : 'text-accent-strong'}`}>
                  {e.type === 'purchase' ? '+' : '−'}{formatMoney(e.type === 'purchase' ? e.credit : e.debit, company?.currency)}
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
        </>
      )}
    </div>
  );
}
