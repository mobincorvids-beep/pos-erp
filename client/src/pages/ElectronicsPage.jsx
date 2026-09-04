import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function ElectronicsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('check');
  const tabs = [['check', t('electronics.checkWarranty')], ['register', t('electronics.registerWarranty')], ['claims', t('electronics.claims')]];
  return (
    <div>
      <div className="mb-5">
        <p className="eyebrow mb-1">{t('electronics.electronics')}</p>
        <p className="page-title">{t('electronics.warrantyDesk')}</p>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>{label}</button>
        ))}
      </div>
      {tab === 'check' && <CheckTab />}
      {tab === 'register' && <RegisterTab />}
      {tab === 'claims' && <ClaimsTab />}
    </div>
  );
}

function CheckTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [serialNumber, setSerialNumber] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');

  async function check(e) {
    e.preventDefault();
    try {
      const r = await api.get(`/electronics/warranties/${serialNumber}/check`);
      setResult(r);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function submitClaim() {
    setSubmitting(true);
    try {
      await api.post(`/electronics/warranties/${result.warranty._id}/claims`, { issueDescription });
      toast(t('electronics.claimSubmitted'), 'success');
      setIssueDescription('');
    } catch (err) { toast(err.message, 'error'); } finally { setSubmitting(false); }
  }

  return (
    <div className="max-w-sm">
      <form onSubmit={check} className="card p-5 mb-4">
        <label className="field-label">{t('electronics.serialNumber')}</label>
        <input required className="field-input mb-3" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder={t('electronics.serialNumberPlaceholder')} />
        <button type="submit" className="btn-primary w-full">{t('electronics.checkWarranty')}</button>
      </form>
      {result && !result.found && <EmptyState title={t('electronics.noWarrantyFound')} />}
      {result && result.found && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className={result.underWarranty ? 'chip-accent' : 'chip-danger'}>{result.underWarranty ? t('electronics.underWarranty') : t('electronics.expired')}</p>
          </div>
          <p className="text-sm text-ink-muted mt-2">{result.underWarranty ? t('electronics.daysRemaining', { count: result.daysRemaining }) : t('electronics.expiredDaysAgo', { count: result.daysExpired })}</p>
          {result.underWarranty && (
            <>
              <div className="tear-line my-4" />
              <label className="field-label">{t('electronics.submitAClaim')}</label>
              <textarea className="field-input mb-2" rows={2} value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} placeholder={t('electronics.describeTheIssue')} />
              <button className="btn-secondary w-full" disabled={!issueDescription || submitting} onClick={submitClaim}>{submitting ? t('electronics.submittingEllipsis') : t('electronics.submitClaim')}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RegisterTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ serialNumber: '', warrantyMonths: 12, customerId: '', startDate: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/electronics/warranties', { ...form, warrantyMonths: Number(form.warrantyMonths) });
      toast(t('electronics.warrantyRegistered'), 'success');
      setForm({ serialNumber: '', warrantyMonths: 12, customerId: '', startDate: '' });
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 max-w-sm">
      <p className="font-display text-lg text-ink mb-4">{t('electronics.registerAWarranty')}</p>
      <div className="space-y-3">
        <div><label className="field-label">{t('electronics.serialNumber')}</label><input required className="field-input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></div>
        <div><label className="field-label">{t('electronics.customer')}</label><select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">{t('electronics.selectEllipsis')}</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
        <div><label className="field-label">{t('electronics.warrantyMonths')}</label><input type="number" className="field-input num" value={form.warrantyMonths} onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })} /></div>
        <div><label className="field-label">{t('electronics.startDate')}</label><input type="date" className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full mt-5">{saving ? t('electronics.registeringEllipsis') : t('electronics.register')}</button>
    </form>
  );
}

function ClaimsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/electronics/claims').then(setClaims).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  async function decide(id, approve) {
    try {
      await api.post(`/electronics/claims/${id}/decide`, { approve });
      toast(approve ? t('electronics.approved') : t('electronics.rejected'), 'success');
      setClaims((prev) => prev.map((c) => c._id === id ? { ...c, status: approve ? 'approved' : 'rejected' } : c));
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (claims.length === 0) return <EmptyState title={t('electronics.noClaimsYet')} />;
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
              <th className="px-4 py-3 font-semibold">{t('electronics.issue')}</th>
              <th className="px-4 py-3 font-semibold">{t('electronics.status')}</th>
              <th className="px-4 py-3 font-semibold text-right">{t('electronics.decision')}</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-paper">
                <td className="px-4 py-3 text-ink">{c.issueDescription}</td>
                <td className="px-4 py-3"><span className="chip-neutral">{c.status}</span></td>
                <td className="px-4 py-3 text-right">
                  {c.status === 'submitted' && (
                    <div className="inline-flex gap-1">
                      <button className="btn-ghost !text-accent" onClick={() => decide(c._id, true)}>{t('electronics.approve')}</button>
                      <button className="btn-ghost !text-danger" onClick={() => decide(c._id, false)}>{t('electronics.reject')}</button>
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
