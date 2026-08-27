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
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit

  function load() {
    setLoading(true);
    api.get('/suppliers').then(setSuppliers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <p className="page-title">Suppliers</p>
            <p className="text-sm text-ink-muted mt-1">Manage supplier records, payables and portal access.</p>
          </div>
          <button className="btn-primary" onClick={() => setEditing({})}>
            <span className="font-icon text-sm">add</span>
            New supplier
          </button>
        </div>

        {loading && <Loading />}
        {!loading && suppliers.length === 0 && (
          <EmptyState title="No suppliers yet" description="Add suppliers to track purchases and payables." action={<button className="btn-primary" onClick={() => setEditing({})}>Add a supplier</button>} />
        )}
        {!loading && suppliers.length > 0 && (
          <section className="card overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-rule flex justify-between items-center">
              <p className="font-display text-lg font-semibold text-ink">Supplier Directory</p>
              <span className="eyebrow">{suppliers.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-rule bg-surface-sunken/60">
                    <th className="py-3 px-5 eyebrow font-medium">Name</th>
                    <th className="py-3 px-5 eyebrow font-medium">Phone</th>
                    <th className="py-3 px-5 eyebrow font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr
                      key={s._id}
                      className={`border-b border-rule last:border-0 hover:bg-paper transition-colors group ${selected?._id === s._id ? 'bg-accent-soft/40' : ''}`}
                    >
                      <td className="py-3.5 px-5 cursor-pointer font-medium text-ink group-hover:text-accent-strong transition-colors" onClick={() => setSelected(s)}>{s.name}</td>
                      <td className="py-3.5 px-5 num text-ink-muted cursor-pointer" onClick={() => setSelected(s)}>{s.phone || '—'}</td>
                      <td className="py-3.5 px-5 text-right"><button className="btn-ghost !px-2 text-xs" onClick={() => setEditing(s)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {selected && <SupplierLedgerPanel supplier={selected} onClose={() => setSelected(null)} />}
      {editing !== null && <SupplierForm supplier={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function SupplierForm({ supplier, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !supplier._id;
  const [form, setForm] = useState({ name: supplier.name || '', phone: supplier.phone || '', email: supplier.email || '', address: supplier.address || '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/suppliers', form);
        toast('Supplier added.', 'success');
      } else {
        await api.put(`/suppliers/${supplier._id}`, form);
        toast('Supplier updated.', 'success');
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
        <p className="font-display text-lg mb-4">{isNew ? 'New supplier' : 'Edit supplier'}</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Phone</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="field-label">Email</label><input type="email" className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="field-label">Address</label><input className="field-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
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
    <aside className="w-full lg:w-96 shrink-0 card overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-rule bg-surface-sunken/60 flex items-center justify-between">
        <p className="font-display text-lg font-semibold text-ink flex items-center gap-2">
          <span className="font-icon text-accent text-lg">storefront</span>
          {supplier.name}
        </p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>

      <div className="p-5 flex flex-col gap-5">
        <InviteSupplierPortalButton supplier={supplier} />

        {loading && <Loading />}
        {ledger && (
          <>
            <div className="bg-paper border border-rule rounded-xl p-4">
              <p className="eyebrow mb-2">Transactions</p>
              <div className="space-y-1.5 text-sm max-h-56 overflow-y-auto">
                {ledger.entries.length === 0 && <p className="text-ink-muted">No transactions yet.</p>}
                {ledger.entries.map((e, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span className="text-ink-muted">{formatDate(e.date)} — {e.type === 'purchase' ? `PO ${e.reference}` : e.type === 'purchase_payment' ? `Paid at receiving ${e.reference}` : 'Payment'}</span>
                    <span className={`num shrink-0 ${e.type === 'purchase' ? 'text-ink' : 'text-accent-strong'}`}>
                      {e.type === 'purchase' ? '+' : '−'}{formatMoney(e.type === 'purchase' ? e.credit : e.debit, company?.currency)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="tear-line my-3" />
              <div className="flex justify-between text-base font-semibold">
                <span>Balance owed</span>
                <span className={`num ${ledger.closingBalance > 0 ? 'text-warning' : 'text-accent-strong'}`}>{formatMoney(ledger.closingBalance, company?.currency)}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink mb-2">Record a payment</p>
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
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function InviteSupplierPortalButton({ supplier }) {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState(supplier.email || '');
  const [inviteLink, setInviteLink] = useState('');
  const [sending, setSending] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();
    setSending(true);
    try {
      const result = await api.post('/supplier-portal/invite', { supplierId: supplier._id, email });
      // No email provider is wired up yet, so the invite link is shown
      // directly here to copy/send manually — see supplierPortalController.js.
      setInviteLink(`${window.location.origin}/supplier-portal/activate?token=${result.inviteToken}`);
      toast('Portal invite created.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  if (!showForm) {
    return (
      <button className="chip-info hover:opacity-80 transition-opacity" onClick={() => setShowForm(true)}>
        <span className="font-icon text-sm mr-1">forward_to_inbox</span>
        Invite to supplier portal
      </button>
    );
  }

  return (
    <div className="p-3 border border-rule rounded-xl bg-surface-sunken/50">
      {!inviteLink ? (
        <form onSubmit={handleInvite} className="space-y-2">
          <label className="field-label">Portal email</label>
          <input type="email" required className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={sending} className="btn-primary text-xs">{sending ? 'Sending…' : 'Create invite'}</button>
          </div>
        </form>
      ) : (
        <div>
          <p className="text-xs text-ink-muted mb-1">Send this activation link to the supplier:</p>
          <input readOnly className="field-input text-xs" value={inviteLink} onClick={(e) => e.target.select()} />
          <button className="text-xs text-accent mt-2 font-semibold" onClick={() => { setShowForm(false); setInviteLink(''); }}>Done</button>
        </div>
      )}
    </div>
  );
}
