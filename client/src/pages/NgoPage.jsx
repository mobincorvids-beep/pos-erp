import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function NgoPage() {
  const { t } = useTranslation();
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">{t('ngo.ngoAndGrantManagement')}</p>
          <p className="page-title">{t('ngo.funds')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-base leading-none">add</span>
          {t('ngo.newFund')}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {loading && <Loading />}
          {!loading && funds.length === 0 && <EmptyState title={t('ngo.noFundsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('ngo.createOne')}</button>} />}
          {!loading && funds.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-widest">
                      <th className="px-4 py-3 font-semibold">{t('ngo.name')}</th>
                      <th className="px-4 py-3 font-semibold">{t('ngo.type')}</th>
                      <th className="px-4 py-3 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {funds.map((f) => (
                      <tr
                        key={f._id}
                        onClick={() => setSelected(f)}
                        className={`border-b border-rule last:border-0 cursor-pointer hover:bg-surface-sunken transition-colors ${selected?._id === f._id ? 'bg-accent-soft' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium text-ink">{f.name}</td>
                        <td className="px-4 py-3">
                          <span className={f.type === 'restricted' ? 'chip-warning' : 'chip-neutral'}>{f.type}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-accent text-xs font-semibold">{t('ngo.viewLedgerArrow')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {selected && <FundPanel fund={selected} onClose={() => setSelected(null)} />}
      </div>

      {showForm && <FundForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function FundForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState('unrestricted');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/ngo/funds', { name, type });
      toast(t('ngo.fundCreated'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('ngo.newFund')}</p>
        <div className="space-y-3">
          <div>
            <p className="field-label">{t('ngo.name')}</p>
            <input required className="field-input" placeholder={t('ngo.name')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <p className="field-label">{t('ngo.type')}</p>
            <select className="field-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="unrestricted">{t('ngo.unrestricted')}</option>
              <option value="restricted">{t('ngo.restricted')}</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('ngo.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('ngo.creating') : t('ngo.create')}</button>
        </div>
      </form>
    </div>
  );
}

function FundPanel({ fund, onClose }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [ledger, setLedger] = useState(null);
  const [showDonate, setShowDonate] = useState(false);
  const [showDisburse, setShowDisburse] = useState(false);

  function load() {
    api.get(`/ngo/funds/${fund._id}/ledger`).then(setLedger).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [fund._id]);

  const balance = ledger?.reduce((sum, tr) => sum + (tr.type === 'donation' ? tr.amount : -tr.amount), 0) || 0;

  return (
    <div className="w-full lg:w-96 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-lg font-bold text-ink">{fund.name}</p>
        <button className="btn-ghost !px-2 !py-1 text-xs" onClick={onClose}>{t('ngo.close')}</button>
      </div>

      <div className="rounded-lg bg-accent-strong text-white p-4 mb-4">
        <p className="eyebrow text-white/70 mb-1">{t('ngo.balance')}</p>
        <p className="font-display text-2xl font-bold num">{formatMoney(balance, company?.currency)}</p>
      </div>

      <div className="flex gap-2 mb-5">
        <button className="btn-secondary flex-1" onClick={() => setShowDonate(true)}>{t('ngo.recordDonation')}</button>
        <button className="btn-secondary flex-1" onClick={() => setShowDisburse(true)}>{t('ngo.disburse')}</button>
      </div>

      <p className="eyebrow mb-2">{t('ngo.transactions')}</p>
      {!ledger && <Loading />}
      {ledger?.length === 0 && <p className="text-sm text-ink-muted">{t('ngo.noTransactionsYet')}</p>}
      <div className="divide-y divide-rule">
        {ledger?.map((tr) => (
          <div key={tr._id} className="flex items-center justify-between py-2.5 text-sm">
            <div>
              <p className="text-ink">{tr.type === 'donation' ? (tr.donorCustomerId?.name || t('ngo.donation')) : tr.description}</p>
              <p className="text-xs text-ink-muted">{formatDate(tr.createdAt)}</p>
            </div>
            <span className={`num font-semibold ${tr.type === 'donation' ? 'text-accent' : 'text-danger'}`}>{tr.type === 'donation' ? '+' : '-'}{formatMoney(tr.amount, company?.currency)}</span>
          </div>
        ))}
      </div>

      {showDonate && <DonateForm fund={fund} onClose={() => setShowDonate(false)} onSaved={() => { setShowDonate(false); load(); }} />}
      {showDisburse && <DisburseForm fund={fund} onClose={() => setShowDisburse(false)} onSaved={() => { setShowDisburse(false); load(); }} />}
    </div>
  );
}

function DonateForm({ fund, onClose, onSaved }) {
  const { t } = useTranslation();
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
      toast(t('ngo.donationRecorded'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('ngo.recordDonation')}</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">{t('ngo.branchEllipsis')}</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select className="field-input" value={form.donorCustomerId} onChange={(e) => setForm({ ...form, donorCustomerId: e.target.value })}>
            <option value="">{t('ngo.anonymousWalkIn')}</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <input type="number" required className="field-input num" placeholder={t('ngo.amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className="field-input" placeholder={t('ngo.descriptionOptional')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select required className="field-input" value={form.receivingAccountId} onChange={(e) => setForm({ ...form, receivingAccountId: e.target.value })}>
            <option value="">{t('ngo.receivedIntoEllipsis')}</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <select required className="field-input" value={form.donationRevenueAccountId} onChange={(e) => setForm({ ...form, donationRevenueAccountId: e.target.value })}>
            <option value="">{t('ngo.donationRevenueAccountEllipsis')}</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('ngo.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('ngo.recording') : t('ngo.record')}</button>
        </div>
      </form>
    </div>
  );
}

function DisburseForm({ fund, onClose, onSaved }) {
  const { t } = useTranslation();
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
      toast(t('ngo.disbursementRecorded'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('ngo.disburse')}</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">{t('ngo.branchEllipsis')}</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <input type="number" required className="field-input num" placeholder={t('ngo.amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input required className="field-input" placeholder={t('ngo.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select required className="field-input" value={form.expenseAccountId} onChange={(e) => setForm({ ...form, expenseAccountId: e.target.value })}>
            <option value="">{t('ngo.expenseAccountEllipsis')}</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <select required className="field-input" value={form.payingAccountId} onChange={(e) => setForm({ ...form, payingAccountId: e.target.value })}>
            <option value="">{t('ngo.paidFromEllipsis')}</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('ngo.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('ngo.disbursing') : t('ngo.disburse')}</button>
        </div>
      </form>
    </div>
  );
}
