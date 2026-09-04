import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { open: 'chip-accent', full: 'chip-warning', departed: 'chip-neutral', cancelled: 'chip-danger' };

export function HajjUmrahPage() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [enrolling, setEnrolling] = useState(null);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    api.get('/hajj-umrah/groups').then(setGroups).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const total = groups.length;
  const openGroups = groups.filter((g) => g.status === 'open');
  const totalEnrolled = groups.reduce((sum, g) => sum + g.enrolledCustomerIds.length, 0);
  const totalCapacity = groups.reduce((sum, g) => sum + g.capacity, 0);
  const nextDeparture = openGroups.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate))[0];

  return (
    <div>
      <div className="flex justify-between items-end mb-6 flex-wrap gap-3">
        <div>
          <p className="eyebrow mb-1">{t('hajjUmrah.title')}</p>
          <p className="page-title">{t('hajjUmrah.pilgrimageGroups')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('hajjUmrah.newGroup')}</button>
      </div>

      {!loading && total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-5">
            <p className="eyebrow">{t('hajjUmrah.totalGroups')}</p>
            <p className="font-display text-3xl font-bold text-ink mt-3 num">{total}</p>
          </div>
          <div className="card p-5">
            <p className="eyebrow">{t('hajjUmrah.enrolled')}</p>
            <div className="flex items-baseline gap-2 mt-3">
              <p className="font-display text-3xl font-bold text-ink num">{totalEnrolled}</p>
              <span className="text-sm text-ink-muted num">/ {totalCapacity}</span>
            </div>
            <div className="w-full bg-surface-sunken rounded-full h-2 mt-3">
              <div className="bg-accent h-2 rounded-full" style={{ width: `${totalCapacity ? (totalEnrolled / totalCapacity) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="rounded-xl bg-accent text-white p-5 flex flex-col justify-between">
            <p className="eyebrow !text-white/70">{t('hajjUmrah.nextDeparture')}</p>
            {nextDeparture ? (
              <div className="mt-3">
                <p className="font-display text-xl font-bold">{nextDeparture.packageName}</p>
                <p className="text-sm text-white/80 mt-1">{formatDate(nextDeparture.departureDate)} · {nextDeparture.enrolledCustomerIds.length}/{nextDeparture.capacity} {t('hajjUmrah.enrolledLower')}</p>
              </div>
            ) : (
              <p className="text-sm text-white/80 mt-3">{t('hajjUmrah.noOpenGroups')}</p>
            )}
          </div>
        </div>
      )}

      {loading && <Loading />}
      {!loading && groups.length === 0 && <EmptyState title={t('hajjUmrah.noGroupsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('hajjUmrah.createOne')}</button>} />}
      {!loading && groups.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">{t('hajjUmrah.package')}</th>
                <th className="px-4 py-3 font-medium">{t('hajjUmrah.departure')}</th>
                <th className="px-4 py-3 font-medium">{t('hajjUmrah.enrolled')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('hajjUmrah.price')}</th>
                <th className="px-4 py-3 font-medium">{t('hajjUmrah.status')}</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g._id} className="border-b border-rule last:border-0 hover:bg-paper transition-colors">
                  <td className="px-4 py-3">{g.packageName}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(g.departureDate)}</td>
                  <td className="px-4 py-3 text-ink-muted num">{g.enrolledCustomerIds.length}/{g.capacity} {g.waitlistCustomerIds.length > 0 && <span className="text-warning">(+{g.waitlistCustomerIds.length} {t('hajjUmrah.waitlist')})</span>}</td>
                  <td className="px-4 py-3 num text-right">{formatMoney(g.packagePrice, company?.currency)}</td>
                  <td className="px-4 py-3"><span className={STATUS_CHIP[g.status]}>{g.status}</span></td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {g.status === 'open' && <button className="btn-ghost !text-accent" onClick={() => setEditing(g)}>{t('hajjUmrah.edit')}</button>}
                    {g.status === 'open' && <button className="btn-ghost !text-accent" onClick={() => setEnrolling(g)}>{t('hajjUmrah.enroll')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <GroupForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <GroupEditForm group={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {enrolling && <EnrollForm group={enrolling} onClose={() => setEnrolling(null)} onSaved={() => { setEnrolling(null); load(); }} />}
    </div>
  );
}

function GroupEditForm({ group, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ packageName: group.packageName, departureDate: group.departureDate?.slice(0, 10) || '', capacity: group.capacity, packagePrice: group.packagePrice });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/hajj-umrah/groups/${group._id}`, { ...form, capacity: Number(form.capacity), packagePrice: Number(form.packagePrice) });
      toast(t('hajjUmrah.groupUpdated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('hajjUmrah.editGroup')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('hajjUmrah.packageName')}</label><input required className="field-input" value={form.packageName} onChange={(e) => setForm({ ...form, packageName: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">{t('hajjUmrah.departureDate')}</label><input type="date" required className="field-input" value={form.departureDate} onChange={(e) => setForm({ ...form, departureDate: e.target.value })} /></div>
            <div><label className="field-label">{t('hajjUmrah.capacity')}</label><input type="number" required min={group.enrolledCustomerIds.length} className="field-input num" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
          </div>
          {Number(form.capacity) < group.enrolledCustomerIds.length && <p className="text-xs text-danger">{t('hajjUmrah.cannotGoBelowEnrolled', { count: group.enrolledCustomerIds.length })}</p>}
          <div><label className="field-label">{t('hajjUmrah.packagePrice')}</label><input type="number" required className="field-input num" value={form.packagePrice} onChange={(e) => setForm({ ...form, packagePrice: e.target.value })} /></div>
          <p className="text-xs text-ink-muted">{t('hajjUmrah.priceChangeNote')}</p>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hajjUmrah.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hajjUmrah.saving') : t('hajjUmrah.save')}</button>
        </div>
      </form>
    </div>
  );
}

function GroupForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', packageName: '', departureDate: '', capacity: '', packagePrice: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/hajj-umrah/groups', { ...form, capacity: Number(form.capacity), packagePrice: Number(form.packagePrice) });
      toast(t('hajjUmrah.groupCreated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('hajjUmrah.newGroup')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('hajjUmrah.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('hajjUmrah.select')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">{t('hajjUmrah.packageName')}</label><input required className="field-input" value={form.packageName} onChange={(e) => setForm({ ...form, packageName: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">{t('hajjUmrah.departureDate')}</label><input type="date" required className="field-input" value={form.departureDate} onChange={(e) => setForm({ ...form, departureDate: e.target.value })} /></div>
            <div><label className="field-label">{t('hajjUmrah.capacity')}</label><input type="number" required className="field-input num" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
          </div>
          <div><label className="field-label">{t('hajjUmrah.packagePrice')}</label><input type="number" required className="field-input num" value={form.packagePrice} onChange={(e) => setForm({ ...form, packagePrice: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hajjUmrah.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hajjUmrah.creating') : t('hajjUmrah.create')}</button>
        </div>
      </form>
    </div>
  );
}

function EnrollForm({ group, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [depositLiabilityAccountId, setDepositLiabilityAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts').then((rows) => setAccounts(rows.filter((a) => a.type === 'liability'))).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post(`/hajj-umrah/groups/${group._id}/enroll`, { customerId, depositLiabilityAccountId });
      toast(result.waitlisted ? t('hajjUmrah.groupFullWaitlisted', { position: result.waitlistPosition }) : t('hajjUmrah.enrolledSuccess'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-1">{t('hajjUmrah.enrollColon')} {group.packageName}</p>
        <p className="text-sm text-ink-muted mb-4 num">{group.enrolledCustomerIds.length}/{group.capacity} {t('hajjUmrah.enrolledLower')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('hajjUmrah.customer')}</label>
            <select required className="field-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{t('hajjUmrah.select')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('hajjUmrah.depositLiabilityAccount')}</label>
            <select required className="field-input" value={depositLiabilityAccountId} onChange={(e) => setDepositLiabilityAccountId(e.target.value)}>
              <option value="">{t('hajjUmrah.select')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hajjUmrah.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hajjUmrah.enrolling') : t('hajjUmrah.enroll')}</button>
        </div>
      </form>
    </div>
  );
}
