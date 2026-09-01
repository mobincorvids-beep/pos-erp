import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { Pencil, Trash2, Plus, Building2, Landmark, Send } from 'lucide-react';
import { FieldError, errorInputClass } from '../components/FieldError';
import { validate, validateRequired, validatePositiveNumber, hasErrors } from '../lib/validation';

const CURRENCIES = ['PKR', 'USD', 'AED', 'SAR', 'GBP', 'EUR', 'INR'];

export function SettingsPage() {
  const { t } = useTranslation();
  const { can, refreshUser } = useAuth();
  const canManage = can('roles.manage');
  const [tab, setTab] = useState('business');

  return (
    <div>
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <p className="page-title mb-1">{t('settings.title')}</p>
          <p className="text-sm text-ink-muted max-w-2xl">{t('settings.subtitle')}</p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-surface-sunken border border-rule">
          {[['business', t('settings.tabBusiness')], ['branches', t('settings.tabBranches')], ['tax-payments', t('settings.tabTaxPayments')]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={tab === key ? 'pill-active' : 'pill border-transparent hover:bg-surface'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'business' && <BusinessDetailsTab canManage={canManage} onSaved={refreshUser} />}
      {tab === 'branches' && <BranchesTab canManage={canManage} />}
      {tab === 'tax-payments' && <TaxPaymentsTab canManage={canManage} />}
    </div>
  );
}

function BusinessDetailsTab({ canManage, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.get('/org/company')
      .then((data) => { setCompany(data); setForm(data); })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put('/org/company', {
        name: form.name, ntn: form.ntn, strn: form.strn, fbrPosId: form.fbrPosId,
        fbrApiToken: form.fbrApiToken, fbrSandboxMode: form.fbrSandboxMode,
        phone: form.phone, email: form.email, address: form.address,
        currency: form.currency, timezone: form.timezone,
      });
      setCompany(updated);
      toast(t('settings.businessSaved'), 'success');
      onSaved?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) return <Loading />;

  return (
    <form onSubmit={handleSubmit} className="card max-w-2xl overflow-hidden">
      <div className="p-5 border-b border-rule flex items-center gap-2">
        <Building2 size={18} className="text-accent" />
        <p className="font-display text-lg font-semibold text-ink">{t('settings.companyProfile')}</p>
      </div>
      <div className="p-5 space-y-4">
      {!canManage && (
        <p className="text-xs text-ink-muted bg-surface-sunken rounded-lg px-3 py-2">{t('settings.viewOnlyBusiness')}</p>
      )}
      <fieldset disabled={!canManage} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t('settings.fieldBusinessName')}</label>
            <input required className="field-input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('settings.fieldIndustryType')}</label>
            <input disabled className="field-input opacity-60" value={form.industryType || ''} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t('settings.fieldPhone')}</label>
            <input className="field-input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('settings.fieldEmail')}</label>
            <input type="email" className="field-input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="field-label">{t('settings.fieldAddress')}</label>
          <input className="field-input" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="field-label">{t('settings.fieldNtn')}</label>
            <input className="field-input" value={form.ntn || ''} onChange={(e) => setForm({ ...form, ntn: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('settings.fieldStrn')}</label>
            <input className="field-input" value={form.strn || ''} onChange={(e) => setForm({ ...form, strn: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('settings.fieldFbrPosId')}</label>
            <input className="field-input" value={form.fbrPosId || ''} onChange={(e) => setForm({ ...form, fbrPosId: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="field-label">{t('settings.fieldFbrApiToken')}</label>
          <input
            type="password" autoComplete="off" className="field-input"
            value={form.fbrApiToken || ''} onChange={(e) => setForm({ ...form, fbrApiToken: e.target.value })}
          />
          <p className="text-xs text-ink-muted mt-1">
            {t('settings.fbrTokenHint')}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox" checked={form.fbrSandboxMode ?? true}
            onChange={(e) => setForm({ ...form, fbrSandboxMode: e.target.checked })}
          />
          {t('settings.sandboxMode')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t('settings.fieldCurrency')}</label>
            <select className="field-input" value={form.currency || 'PKR'} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('settings.fieldTimezone')}</label>
            <input className="field-input" value={form.timezone || ''} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
        </div>
      </fieldset>
      {canManage && (
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('common.saving') : t('settings.saveChanges')}</button>
        </div>
      )}
      </div>
    </form>
  );
}

function BranchesTab({ canManage }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...branch} = edit

  function load() {
    setLoading(true);
    api.get('/org/branches').then(setBranches).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleRemove(branch) {
    if (!window.confirm(t('settings.removeBranchConfirm', { name: branch.name }))) return;
    try {
      await api.del(`/org/branches/${branch._id}`);
      toast(t('settings.branchRemoved'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-rule flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-display text-lg font-semibold text-ink">{t('settings.branches')}</p>
            <p className="text-sm text-ink-muted max-w-md mt-0.5">{t('settings.branchesDescription')}</p>
          </div>
          {canManage && (
            <button className="btn-primary flex items-center gap-1.5 shrink-0" onClick={() => setEditing({})}>
              <Plus size={14} /> {t('settings.newBranch')}
            </button>
          )}
        </div>

        {loading && <div className="p-5"><Loading /></div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-sunken border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">{t('settings.colName')}</th>
                <th className="px-4 py-3 font-semibold">{t('settings.colCode')}</th>
                <th className="px-4 py-3 font-semibold">{t('settings.colAddress')}</th>
                <th className="px-4 py-3 font-semibold">{t('settings.colPhone')}</th>
                {canManage && <th className="px-4 py-3 font-semibold text-right">{t('settings.colActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{b.name}</td>
                  <td className="px-4 py-3 text-ink-muted num">{b.code || '-'}</td>
                  <td className="px-4 py-3 text-ink-muted">{b.address || '-'}</td>
                  <td className="px-4 py-3 text-ink-muted num">{b.phone || '-'}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className="text-ink-muted hover:text-accent-strong" onClick={() => setEditing(b)} aria-label={t('settings.editBranchAria')}>
                          <Pencil size={15} />
                        </button>
                        <button className="text-ink-muted hover:text-danger" onClick={() => handleRemove(b)} aria-label={t('settings.removeBranchAria')}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <BranchForm branch={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function BranchForm({ branch, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !branch._id;
  const [form, setForm] = useState({ name: branch.name || '', code: branch.code || '', address: branch.address || '', phone: branch.phone || '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/org/branches', form);
        toast(t('settings.branchCreated'), 'success');
      } else {
        await api.put(`/org/branches/${branch._id}`, form);
        toast(t('settings.branchUpdated'), 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-4">{isNew ? t('settings.newBranchTitle') : t('settings.editBranchTitle')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('settings.fieldBranchName')}</label>
            <input required autoFocus placeholder={t('settings.branchNamePlaceholder')} className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('settings.colCode')}</label>
            <input placeholder={t('settings.codePlaceholder')} className="field-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('settings.colAddress')}</label>
            <input className="field-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('settings.colPhone')}</label>
            <input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('common.saving') : isNew ? t('settings.create') : t('common.save')}</button>
        </div>
      </form>
    </div>
  );
}

const TAX_PAYMENT_STATUS_CHIP = {
  pending: 'chip-neutral',
  initiated: 'chip-warning',
  paid: 'chip-info',
  failed: 'chip-danger',
};

/**
 * Vendor-side tax payment tab: shows the company's JazzCash tax-pay
 * credentials (separate from any JazzCash config used for POS checkout —
 * this pays the COMPANY's own FBR liability, not a customer's purchase),
 * a manually-entered liability list, and a "Pay via JazzCash" action per
 * record. Mirrors PosPage.jsx's gateway-payment flow (initiate, then poll
 * /tax-payments/:id for status) but a tax-pay result is typically
 * synchronous, so no polling loop is needed here — the initiate call
 * itself returns the final status.
 */
function TaxPaymentsTab({ canManage }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [company, setCompany] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [payingId, setPayingId] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/org/company'), api.get('/tax-payments')])
      .then(([companyData, paymentRows]) => { setCompany(companyData); setPayments(paymentRows); })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handlePay(taxPayment) {
    if (!window.confirm(t('settings.payConfirm', { amount: formatMoney(taxPayment.amountDue, company?.currency), period: taxPayment.periodLabel }))) return;
    setPayingId(taxPayment._id);
    try {
      const result = await api.post(`/tax-payments/${taxPayment._id}/pay`, {});
      if (result.taxPayment.status === 'paid') {
        toast(t('settings.taxPaid'), 'success');
      } else if (result.taxPayment.status === 'failed') {
        toast(result.responseMessage || t('settings.jazzCashDeclined'), 'error');
      } else {
        toast(t('settings.paymentInitiated'), 'success');
      }
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPayingId(null);
    }
  }

  if (loading || !company) return <Loading />;

  return (
    <div className="space-y-6">
      <JazzCashTaxPayCredentials company={company} canManage={canManage} onSaved={setCompany} />

      <div className="card overflow-hidden">
        <div className="p-5 border-b border-rule flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-display text-lg font-semibold text-ink">{t('settings.taxLiabilities')}</p>
            <p className="text-sm text-ink-muted max-w-md mt-0.5">{t('settings.taxLiabilitiesDescription')}</p>
          </div>
          {canManage && (
            <button className="btn-primary flex items-center gap-1.5 shrink-0" onClick={() => setShowNewForm(true)}>
              <Plus size={14} /> {t('settings.recordLiability')}
            </button>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-sunken border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold">{t('settings.colPeriod')}</th>
              <th className="px-4 py-3 font-semibold">{t('settings.colAuthority')}</th>
              <th className="px-4 py-3 font-semibold text-right">{t('settings.colAmountDue')}</th>
              <th className="px-4 py-3 font-semibold">{t('settings.colStatus')}</th>
              {canManage && <th className="px-4 py-3 font-semibold text-right">{t('settings.colActions')}</th>}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-muted">{t('settings.noLiabilities')}</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                <td className="px-4 py-3 font-medium text-ink">{p.periodLabel}</td>
                <td className="px-4 py-3 text-ink-muted uppercase">{p.taxAuthority}</td>
                <td className="px-4 py-3 text-right num text-ink">{formatMoney(p.amountDue, company.currency)}</td>
                <td className="px-4 py-3"><span className={TAX_PAYMENT_STATUS_CHIP[p.status] || 'chip-neutral'}>{p.status}</span></td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {p.status !== 'paid' ? (
                        <button
                          className="btn-secondary flex items-center gap-1.5 !py-1.5 !px-3 text-xs"
                          disabled={payingId === p._id || !company.jazzCashTaxPay?.enabled}
                          onClick={() => handlePay(p)}
                        >
                          <Send size={13} /> {payingId === p._id ? t('settings.paying') : t('settings.payViaJazzCash')}
                        </button>
                      ) : (
                        <span className="text-xs text-ink-muted">{t('settings.paidOn', { date: p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '' })}</span>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {canManage && !company.jazzCashTaxPay?.enabled && payments.length > 0 && (
          <p className="text-xs text-ink-muted bg-surface-sunken px-5 py-3 border-t border-rule">{t('settings.addCredentialsHint')}</p>
        )}
      </div>

      {showNewForm && <NewTaxLiabilityForm onClose={() => setShowNewForm(false)} onSaved={() => { setShowNewForm(false); load(); }} />}
    </div>
  );
}

function formatMoney(amount, currency) {
  const value = Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency || 'PKR'} ${value}`;
}

function NewTaxLiabilityForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ periodLabel: '', taxAuthority: 'fbr', amountDue: '' });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});

  const rules = {
    periodLabel: (v) => validateRequired(v, 'Period'),
    amountDue: (v) => validatePositiveNumber(v, 'Amount due'),
  };
  const errors = validate(form, rules);

  function markTouched(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ periodLabel: true, amountDue: true });
    if (hasErrors(errors)) return;
    setSaving(true);
    try {
      await api.post('/tax-payments', {
        periodLabel: form.periodLabel,
        taxAuthority: form.taxAuthority,
        amountDue: Number(form.amountDue),
      });
      toast(t('settings.taxLiabilityRecorded'), 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('settings.recordTaxLiability')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('settings.colPeriod')}</label>
            <input
              required autoFocus placeholder={t('settings.periodPlaceholder')} maxLength={60}
              className={`field-input ${errorInputClass(touched.periodLabel && errors.periodLabel)}`}
              value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })}
              onBlur={() => markTouched('periodLabel')}
              aria-invalid={Boolean(touched.periodLabel && errors.periodLabel)}
            />
            <FieldError message={touched.periodLabel ? errors.periodLabel : null} />
          </div>
          <div>
            <label className="field-label">{t('settings.colAuthority')}</label>
            <select className="field-input" value={form.taxAuthority} onChange={(e) => setForm({ ...form, taxAuthority: e.target.value })}>
              {['fbr', 'srb', 'pra', 'kpra', 'bra'].map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('settings.colAmountDue')}</label>
            <input
              required type="number" min="0.01" step="0.01"
              className={`field-input ${errorInputClass(touched.amountDue && errors.amountDue)}`}
              value={form.amountDue} onChange={(e) => setForm({ ...form, amountDue: e.target.value })}
              onBlur={() => markTouched('amountDue')}
              aria-invalid={Boolean(touched.amountDue && errors.amountDue)}
            />
            <FieldError message={touched.amountDue ? errors.amountDue : null} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving || hasErrors(errors)} className="btn-primary">{saving ? t('common.saving') : t('settings.record')}</button>
        </div>
      </form>
    </div>
  );
}

/** Lets the vendor plug in their own JazzCash merchant credentials for paying tax liability — kept distinct from any JazzCash config used for POS checkout since this is per-tenant, not platform-wide. */
function JazzCashTaxPayCredentials({ company, canManage, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const cfg = company.jazzCashTaxPay || {};
  const [form, setForm] = useState({
    enabled: !!cfg.enabled,
    merchantId: cfg.merchantId || '',
    password: cfg.password || '',
    integritySalt: cfg.integritySalt || '',
    fbrAccountNumber: cfg.fbrAccountNumber || '',
    fbrAccountTitle: cfg.fbrAccountTitle || '',
  });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});

  // Credentials are only required once the vendor turns this on — leaving it off with
  // blank fields is a perfectly valid (default) state.
  const rules = {
    merchantId: (v) => (form.enabled ? validateRequired(v, 'JazzCash Merchant ID') : null),
    password: (v) => (form.enabled ? validateRequired(v, 'Password') : null),
    integritySalt: (v) => (form.enabled ? validateRequired(v, 'Integrity Salt') : null),
  };
  const errors = validate(form, rules);

  function markTouched(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ merchantId: true, password: true, integritySalt: true });
    if (hasErrors(errors)) return;
    setSaving(true);
    try {
      const updated = await api.put('/org/company', { jazzCashTaxPay: form });
      onSaved(updated);
      toast(t('settings.jazzCashSaved'), 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-2xl overflow-hidden">
      <div className="p-5 border-b border-rule flex items-center gap-2">
        <Landmark size={18} className="text-accent" />
        <p className="font-display text-lg font-semibold text-ink">{t('settings.jazzCashCredentials')}</p>
      </div>
      <div className="p-5 space-y-4">
        {!canManage && (
          <p className="text-xs text-ink-muted bg-surface-sunken rounded-lg px-3 py-2">{t('settings.viewOnlyConfig')}</p>
        )}
        <fieldset disabled={!canManage} className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            {t('settings.enableJazzCashTaxPay')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('settings.fieldMerchantId')}</label>
              <input
                className={`field-input ${errorInputClass(touched.merchantId && errors.merchantId)}`}
                value={form.merchantId} onChange={(e) => setForm({ ...form, merchantId: e.target.value })}
                onBlur={() => markTouched('merchantId')}
                aria-invalid={Boolean(touched.merchantId && errors.merchantId)}
              />
              <FieldError message={touched.merchantId ? errors.merchantId : null} />
            </div>
            <div>
              <label className="field-label">{t('settings.fieldPassword')}</label>
              <input
                type="password" autoComplete="new-password"
                className={`field-input ${errorInputClass(touched.password && errors.password)}`}
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                onBlur={() => markTouched('password')}
                aria-invalid={Boolean(touched.password && errors.password)}
              />
              <FieldError message={touched.password ? errors.password : null} />
            </div>
          </div>
          <div>
            <label className="field-label">{t('settings.fieldIntegritySalt')}</label>
            <input
              type="password" autoComplete="new-password"
              className={`field-input ${errorInputClass(touched.integritySalt && errors.integritySalt)}`}
              value={form.integritySalt} onChange={(e) => setForm({ ...form, integritySalt: e.target.value })}
              onBlur={() => markTouched('integritySalt')}
              aria-invalid={Boolean(touched.integritySalt && errors.integritySalt)}
            />
            <FieldError message={touched.integritySalt ? errors.integritySalt : null} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('settings.fieldFbrAccountNumber')}</label>
              <input className="field-input" value={form.fbrAccountNumber} onChange={(e) => setForm({ ...form, fbrAccountNumber: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('settings.fieldFbrAccountTitle')}</label>
              <input className="field-input" value={form.fbrAccountTitle} onChange={(e) => setForm({ ...form, fbrAccountTitle: e.target.value })} />
            </div>
          </div>
        </fieldset>
        {canManage && (
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving || hasErrors(errors)} className="btn-primary">{saving ? t('common.saving') : t('settings.saveCredentials')}</button>
          </div>
        )}
      </div>
    </form>
  );
}
