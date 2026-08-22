import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function NgoPage() {
  const toast = useToast();
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    api.get('/ngo/funds').then(setFunds).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="page-title">Funds</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>New fund</button>
        </div>
        {loading && <Loading />}
        {!loading && funds.length === 0 && <EmptyState title="No funds yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create one</button>} />}
        {!loading && funds.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {funds.map((f) => (
                  <tr key={f._id} onClick={() => setSelected(f)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === f._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-3 py-2">{f.name}</td>
                    <td className="px-3 py-2"><span className={f.type === 'restricted' ? 'chip-warning' : 'chip-neutral'}>{f.type}</span></td>
                    <td className="px-3 py-2 text-right"><span className="text-accent-strong text-xs">View ledger</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <FundPanel fund={selected} onClose={() => setSelected(null)} />}
      {showForm && <FundForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function FundForm({ onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState('unrestricted');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/ngo/funds', { name, type });
      toast('Fund created.', 'success');
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
        <p className="font-display text-lg mb-4">New fund</p>
        <div className="space-y-3">
          <input required className="field-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="field-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="unrestricted">Unrestricted</option>
            <option value="restricted">Restricted</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

function FundPanel({ fund, onClose }) {
  const { company } = useAuth();
  const toast = useToast();
  const [ledger, setLedger] = useState(null);
  const [showDonate, setShowDonate] = useState(false);
  const [showDisburse, setShowDisburse] = useState(false);

  function load() {
    api.get(`/ngo/funds/${fund._id}/ledger`).then(setLedger).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [fund._id]);

  const balance = ledger?.reduce((sum, t) => sum + (t.type === 'donation' ? t.amount : -t.amount), 0) || 0;

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg">{fund.name}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>
      <p className="text-sm text-ink-muted mb-1">Balance</p>
      <p className="font-display text-2xl num mb-4">{formatMoney(balance, company?.currency)}</p>

      <div className="flex gap-2 mb-4">
        <button className="btn-secondary flex-1" onClick={() => setShowDonate(true)}>Record donation</button>
        <button className="btn-secondary flex-1" onClick={() => setShowDisburse(true)}>Disburse</button>
      </div>

      <p className="text-sm font-medium mb-2">Transactions</p>
      {!ledger && <Loading />}
      {ledger?.length === 0 && <p className="text-sm text-ink-muted">No transactions yet.</p>}
      {ledger?.map((t) => (
        <div key={t._id} className="flex items-center justify-between py-1.5 border-b border-rule last:border-0 text-sm">
          <div>
            <p>{t.type === 'donation' ? (t.donorCustomerId?.name || 'Donation') : t.description}</p>
            <p className="text-xs text-ink-muted">{formatDate(t.createdAt)}</p>
          </div>
          <span className={`num ${t.type === 'donation' ? 'text-accent-strong' : 'text-danger'}`}>{t.type === 'donation' ? '+' : '-'}{formatMoney(t.amount, company?.currency)}</span>
        </div>
      ))}

      {showDonate && <DonateForm fund={fund} onClose={() => setShowDonate(false)} onSaved={() => { setShowDonate(false); load(); }} />}
      {showDisburse && <DisburseForm fund={fund} onClose={() => setShowDisburse(false)} onSaved={() => { setShowDisburse(false); load(); }} />}
    </div>
  );
}

function DonateForm({ fund, onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', donorCustomerId: '', amount: '', description: '', receivingAccountId: '', donationRevenueAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/ngo/funds/${fund._id}/donations`, { ...form, amount: Number(form.amount), donorCustomerId: form.donorCustomerId || undefined });
      toast('Donation recorded.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center z-50 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Record donation</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select className="field-input" value={form.donorCustomerId} onChange={(e) => setForm({ ...form, donorCustomerId: e.target.value })}>
            <option value="">Anonymous / walk-in</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <input type="number" required className="field-input num" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className="field-input" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select required className="field-input" value={form.receivingAccountId} onChange={(e) => setForm({ ...form, receivingAccountId: e.target.value })}>
            <option value="">Received into…</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <select required className="field-input" value={form.donationRevenueAccountId} onChange={(e) => setForm({ ...form, donationRevenueAccountId: e.target.value })}>
            <option value="">Donation revenue account…</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Recording…' : 'Record'}</button>
        </div>
      </form>
    </div>
  );
}

function DisburseForm({ fund, onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', amount: '', description: '', expenseAccountId: '', payingAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/ngo/funds/${fund._id}/disbursements`, { ...form, amount: Number(form.amount) });
      toast('Disbursement recorded.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center z-50 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Disburse</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <input type="number" required className="field-input num" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input required className="field-input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select required className="field-input" value={form.expenseAccountId} onChange={(e) => setForm({ ...form, expenseAccountId: e.target.value })}>
            <option value="">Expense account…</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <select required className="field-input" value={form.payingAccountId} onChange={(e) => setForm({ ...form, payingAccountId: e.target.value })}>
            <option value="">Paid from…</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Disbursing…' : 'Disburse'}</button>
        </div>
      </form>
    </div>
  );
}
