import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useToast } from '../../components/Toast';
import { Loading } from '../../components/Loading';
import { EmptyState } from '../../components/EmptyState';
import { formatDate, formatMoney } from '../../lib/format';

export function AdminCompaniesPage() {
  const toast = useToast();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    adminApi.get('/admin/companies').then(setCompanies).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="page-title">Companies</p>
            <p className="text-sm text-ink-muted mt-0.5">Every tenant on the platform, and their onboarding status.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>Onboard a company</button>
        </div>

        {loading && <Loading />}
        {!loading && companies.length === 0 && (
          <EmptyState title="No companies yet" description="Onboard the first tenant to get started." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Onboard a company</button>} />
        )}
        {!loading && companies.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-sunken border-b border-rule text-left">
                    <th className="px-4 py-3 eyebrow">Name</th>
                    <th className="px-4 py-3 eyebrow">Industry</th>
                    <th className="px-4 py-3 eyebrow">Status</th>
                    <th className="px-4 py-3 eyebrow text-right">Branches</th>
                    <th className="px-4 py-3 eyebrow text-right">Users</th>
                    <th className="px-4 py-3 eyebrow">Onboarded</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c._id} onClick={() => setSelectedId(c._id)} className={`border-b border-rule last:border-0 cursor-pointer transition-colors hover:bg-surface-sunken ${selectedId === c._id ? 'bg-accent-soft' : ''}`}>
                      <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                      <td className="px-4 py-3 capitalize text-ink-muted">{c.industryType}</td>
                      <td className="px-4 py-3"><span className={c.isActive ? 'chip-accent' : 'chip-danger'}>{c.isActive ? 'active' : 'suspended'}</span></td>
                      <td className="px-4 py-3 num text-right">{c.branchCount}</td>
                      <td className="px-4 py-3 num text-right">{c.userCount}</td>
                      <td className="px-4 py-3 text-ink-muted">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedId && <CompanyDetailPanel companyId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
      {showForm && <OnboardForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CompanyDetailPanel({ companyId, onClose, onChanged }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [salesVolume, setSalesVolume] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    adminApi.get(`/admin/companies/${companyId}`).then(setDetail).catch((err) => toast(err.message, 'error'));
    adminApi.get(`/admin/companies/${companyId}/sales-volume`).then(setSalesVolume).catch(() => {});
  }
  useEffect(load, [companyId]);
  useEffect(() => { adminApi.get('/admin/companies/catalog').then(setCatalog).catch(() => {}); }, []);

  async function toggleActive() {
    setBusy(true);
    try {
      await adminApi.post(`/admin/companies/${companyId}/active`, { isActive: !detail.company.isActive });
      toast(detail.company.isActive ? 'Company suspended.' : 'Company activated.', 'success');
      load(); onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function toggleModule(key) {
    const current = detail.company.activeModules || [];
    const next = current.includes(key) ? current.filter((m) => m !== key) : [...current, key];
    try {
      await adminApi.patch(`/admin/companies/${companyId}/modules`, { activeModules: next });
      toast('Modules updated.', 'success');
      load(); onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (!detail) return <div className="w-96 shrink-0 card p-5 h-fit"><Loading /></div>;

  return (
    <div className="w-96 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-1">
        <p className="font-display text-lg font-bold text-ink">{detail.company.name}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>

      {salesVolume && (
        <p className="text-sm text-ink-muted mb-4">
          {formatMoney(salesVolume.netSales, detail.company.currency)} net sales, {salesVolume.invoiceCount} invoices (30d)
        </p>
      )}

      <button className={detail.company.isActive ? 'btn-danger w-full mb-5' : 'btn-primary w-full mb-5'} disabled={busy} onClick={toggleActive}>
        {detail.company.isActive ? 'Suspend company' : 'Reactivate company'}
      </button>

      <p className="eyebrow mb-2">Optional modules</p>
      <div className="space-y-1.5 mb-5">
        {catalog?.optionalModules.map((m) => (
          <label key={m.key} className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={(detail.company.activeModules || []).includes(m.key)} onChange={() => toggleModule(m.key)} />
            {m.label}
          </label>
        ))}
      </div>

      <p className="eyebrow mb-2">Users ({detail.users.length})</p>
      <div className="space-y-1.5 text-sm max-h-40 overflow-y-auto">
        {detail.users.map((u) => (
          <div key={u._id} className="flex items-center justify-between">
            <span className="truncate text-ink">{u.name}</span>
            <span className={u.isActive ? 'chip-accent' : 'chip-danger'}>{u.isActive ? 'active' : 'suspended'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnboardForm({ onClose, onSaved }) {
  const toast = useToast();
  const [catalog, setCatalog] = useState(null);
  const [form, setForm] = useState({ name: '', industryType: 'retail', currency: 'PKR', adminName: '', adminEmail: '' });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { adminApi.get('/admin/companies/catalog').then(setCatalog).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminApi.post('/admin/companies', form);
      setResult(res);
      toast('Company onboarded.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
        <div className="card p-6 w-full max-w-sm">
          <p className="font-display text-lg font-bold text-ink mb-3">{result.company.name} is ready</p>
          <div className="tear-line mb-3" />
          <p className="text-sm mb-1 text-ink"><span className="text-ink-muted">Login email:</span> {result.admin.email}</p>
          <p className="text-sm mb-3 text-ink"><span className="text-ink-muted">Temporary password:</span> <span className="num">{result.generatedPassword}</span></p>
          <p className="text-xs text-ink-muted mb-4">This password is shown once — copy it now. The owner should change it after first login.</p>
          <button className="btn-primary w-full" onClick={() => { onSaved(); }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-md">
        <p className="font-display text-lg font-bold text-ink mb-4">Onboard a company</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Business name</label>
            <input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Industry</label>
              <select className="field-input" value={form.industryType} onChange={(e) => setForm({ ...form, industryType: e.target.value })}>
                {Object.entries(
                  (catalog?.industries || []).reduce((groups, i) => {
                    const cat = i.category || 'Other';
                    (groups[cat] = groups[cat] || []).push(i);
                    return groups;
                  }, {})
                ).map(([category, items]) => (
                  <optgroup key={category} label={category}>
                    {items.map((i) => <option key={i.key} value={i.key}>{i.label}{!i.hasModule ? ' (no dedicated module yet)' : ''}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Currency</label>
              <input className="field-input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Owner's name</label>
            <input required className="field-input" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Owner's email (their login)</label>
            <input type="email" required className="field-input" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Onboarding…' : 'Onboard'}</button>
        </div>
      </form>
    </div>
  );
}
