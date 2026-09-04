import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const INVOICE_CHIP = { pending: 'chip-warning', paid: 'chip-accent', overdue: 'chip-danger', cancelled: 'chip-neutral' };
const COMPLAINT_CHIP = { open: 'chip-warning', assigned: 'chip-accent', resolved: 'chip-neutral' };

function initials(name) {
  if (!name) return '-';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

export function HousingSocietyPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('invoices');
  return (
    <div>
      <p className="eyebrow mb-1">{t('housingSociety.title')}</p>
      <p className="page-title mb-5">{t('housingSociety.managementHub')}</p>
      <div className="flex gap-2 mb-5">
        {[['invoices', t('housingSociety.invoices')], ['complaints', t('housingSociety.complaints')], ['members', t('housingSociety.members')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'complaints' && <ComplaintsTab />}
      {tab === 'members' && <MembersTab />}
    </div>
  );
}

function InvoicesTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [paying, setPaying] = useState(null);

  function load() {
    setLoading(true);
    api.get('/housing-society/invoices').then(setInvoices).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowGenerate(true)}>
          <span className="font-icon text-base leading-none">add</span>
          {t('housingSociety.generateInvoices')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && invoices.length === 0 && <EmptyState title={t('housingSociety.noInvoicesYet')} action={<button className="btn-primary" onClick={() => setShowGenerate(true)}>{t('housingSociety.generateABillingPeriod')}</button>} />}
      {!loading && invoices.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left bg-surface-sunken/50">
                  <th className="px-4 py-3 eyebrow font-medium">{t('housingSociety.property')}</th>
                  <th className="px-4 py-3 eyebrow font-medium">{t('housingSociety.resident')}</th>
                  <th className="px-4 py-3 eyebrow font-medium">{t('housingSociety.period')}</th>
                  <th className="px-4 py-3 eyebrow font-medium text-right">{t('housingSociety.amount')}</th>
                  <th className="px-4 py-3 eyebrow font-medium">{t('housingSociety.status')}</th>
                  <th className="px-4 py-3 eyebrow font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/40 transition-colors">
                    <td className="px-4 py-3 num text-ink">{i.propertyId?.unitNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-xs font-semibold shrink-0">
                          {initials(i.residentCustomerId?.name)}
                        </span>
                        <span className="text-ink">{i.residentCustomerId?.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{i.period}</td>
                    <td className="px-4 py-3 num text-right">{formatMoney(i.amount, company?.currency)}</td>
                    <td className="px-4 py-3"><span className={INVOICE_CHIP[i.status]}>{i.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      {(i.status === 'pending' || i.status === 'overdue') && <button className="btn-ghost !text-accent !px-2 !py-1" onClick={() => setPaying(i)}>{t('housingSociety.pay')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showGenerate && <GenerateForm onClose={() => setShowGenerate(false)} onSaved={() => { setShowGenerate(false); load(); }} />}
      {paying && <PayForm invoice={paying} onClose={() => setPaying(null)} onPaid={() => { setPaying(null); load(); }} />}
    </div>
  );
}

function GenerateForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [charges, setCharges] = useState([]);
  const [chargeId, setChargeId] = useState('');
  const [period, setPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/housing-society/charges').then(setCharges).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post('/housing-society/invoices/generate', { chargeId, period, dueDate });
      toast(`${t('housingSociety.generated')} ${result.created.length} ${t('housingSociety.invoicesLower')}${result.skippedCount > 0 ? `: ${result.skippedCount} ${t('housingSociety.alreadyBilledSkipped')}` : ''}.`, 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-1">{t('housingSociety.generateInvoices')}</p>
        <p className="text-xs text-ink-muted mb-4">{t('housingSociety.generateInvoicesNote')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('housingSociety.charge')}</label>
            <select required className="field-input" value={chargeId} onChange={(e) => setChargeId(e.target.value)}>
              <option value="">{t('housingSociety.chargeEllipsis')}</option>
              {charges.map((c) => <option key={c._id} value={c._id}>{c.name}: {formatMoney(c.amount)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('housingSociety.period')}</label>
            <input required className="field-input" placeholder={t('housingSociety.periodPlaceholder')} value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('housingSociety.dueDate')}</label>
            <input type="date" required className="field-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('housingSociety.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('housingSociety.generating') : t('housingSociety.generate')}</button>
        </div>
      </form>
    </div>
  );
}

function PayForm({ invoice, onClose, onPaid }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (branchId) api.get(`/org/warehouses?branchId=${branchId}`).then(setWarehouses).catch(() => {}); }, [branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/housing-society/invoices/${invoice._id}/pay`, { branchId, warehouseId, paymentAccountId });
      toast(t('housingSociety.invoicePaid'), 'success');
      onPaid();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-semibold text-ink mb-1">{t('housingSociety.payInvoice')}</p>
        <p className="text-sm text-ink-muted mb-4">{invoice.propertyId?.unitNumber}: <span className="num">{formatMoney(invoice.amount, company?.currency)}</span></p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('housingSociety.branch')}</label>
            <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('housingSociety.branchEllipsis')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('housingSociety.warehouse')}</label>
            <select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!branchId}>
              <option value="">{t('housingSociety.warehouseEllipsis')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('housingSociety.paymentAccount')}</label>
            <select required className="field-input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
              <option value="">{t('housingSociety.paymentAccountEllipsis')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('housingSociety.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('housingSociety.paying') : t('housingSociety.pay')}</button>
        </div>
      </form>
    </div>
  );
}

function ComplaintsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignee, setAssignee] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  function load() {
    setLoading(true);
    api.get('/housing-society/complaints').then(setComplaints).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);
  useEffect(() => { if (assigning) api.get('/users').then(setUsers).catch(() => {}); }, [assigning]);

  async function assign() {
    try {
      await api.post(`/housing-society/complaints/${assigning}/assign`, { assignedToUserId: assignee });
      toast(t('housingSociety.assigned'), 'success');
      setAssigning(null); setAssignee('');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function resolve() {
    try {
      await api.post(`/housing-society/complaints/${resolving}/resolve`, { resolutionNote });
      toast(t('housingSociety.resolved'), 'success');
      setResolving(null); setResolutionNote('');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (complaints.length === 0) return <EmptyState title={t('housingSociety.noComplaints')} />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left bg-surface-sunken/50">
              <th className="px-4 py-3 eyebrow font-medium">{t('housingSociety.category')}</th>
              <th className="px-4 py-3 eyebrow font-medium">{t('housingSociety.description')}</th>
              <th className="px-4 py-3 eyebrow font-medium">{t('housingSociety.status')}</th>
              <th className="px-4 py-3 eyebrow font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/40 transition-colors">
                <td className="px-4 py-3 text-ink">{c.category}</td>
                <td className="px-4 py-3 text-ink-muted">{c.description}</td>
                <td className="px-4 py-3"><span className={COMPLAINT_CHIP[c.status]}>{c.status}</span></td>
                <td className="px-4 py-3 text-right">
                  {c.status === 'open' && assigning !== c._id && <button className="btn-ghost !text-accent !px-2 !py-1" onClick={() => setAssigning(c._id)}>{t('housingSociety.assign')}</button>}
                  {assigning === c._id && (
                    <div className="flex gap-1.5 justify-end items-center">
                      <select className="field-input !py-1.5 !text-xs !w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                        <option value="">{t('housingSociety.toEllipsis')}</option>
                        {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                      </select>
                      <button className="btn-ghost !text-accent !px-2 !py-1" disabled={!assignee} onClick={assign}>{t('housingSociety.save')}</button>
                    </div>
                  )}
                  {c.status === 'assigned' && resolving !== c._id && <button className="btn-ghost !text-accent !px-2 !py-1" onClick={() => setResolving(c._id)}>{t('housingSociety.resolve')}</button>}
                  {resolving === c._id && (
                    <div className="flex gap-1.5 justify-end items-center">
                      <input className="field-input !py-1.5 !text-xs" placeholder={t('housingSociety.resolutionNote')} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} />
                      <button className="btn-ghost !text-accent !px-2 !py-1" disabled={!resolutionNote.trim()} onClick={resolve}>{t('housingSociety.save')}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MembersTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/housing-society/members').then(setMembers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (members.length === 0) return <EmptyState title={t('housingSociety.noMembersYet')} />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left bg-surface-sunken/50">
              <th className="px-4 py-3 eyebrow font-medium">{t('housingSociety.property')}</th>
              <th className="px-4 py-3 eyebrow font-medium">{t('housingSociety.resident')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/40 transition-colors">
                <td className="px-4 py-3 num text-ink">{m.propertyId?.unitNumber || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-xs font-semibold shrink-0">
                      {initials(m.residentCustomerId?.name)}
                    </span>
                    <span className="text-ink">{m.residentCustomerId?.name || '-'}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
