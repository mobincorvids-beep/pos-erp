import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { Pencil, Trash2, Plus, Building2, Landmark, Send } from 'lucide-react';

const CURRENCIES = ['PKR', 'USD', 'AED', 'SAR', 'GBP', 'EUR', 'INR'];

export function SettingsPage() {
  const { can, refreshUser } = useAuth();
  const canManage = can('roles.manage');
  const [tab, setTab] = useState('business');

  return (
    <div>
      <div className="flex justify-between items-end mb-5 gap-4 flex-wrap">
        <div>
          <p className="page-title mb-1">Settings</p>
          <p className="text-sm text-ink-muted max-w-2xl">Business profile and branch management for your account.</p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-surface-sunken border border-rule">
          {[['business', 'Business details'], ['branches', 'Branches'], ['tax-payments', 'Tax payments']].map(([key, label]) => (
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
        phone: form.phone, email: form.email, address: form.address,
        currency: form.currency, timezone: form.timezone,
      });
      setCompany(updated);
      toast('Business details saved.', 'success');
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
        <p className="font-display text-lg font-semibold text-ink">Company profile</p>
      </div>
      <div className="p-5 space-y-4">
      {!canManage && (
        <p className="text-xs text-ink-muted bg-surface-sunken rounded-lg px-3 py-2">You can view business details, but only an admin can change them.</p>
      )}
      <fieldset disabled={!canManage} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Business name</label>
            <input required className="field-input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Industry type</label>
            <input disabled className="field-input opacity-60" value={form.industryType || ''} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Phone</label>
            <input className="field-input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input type="email" className="field-input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="field-label">Address</label>
          <input className="field-input" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="field-label">NTN</label>
            <input className="field-input" value={form.ntn || ''} onChange={(e) => setForm({ ...form, ntn: e.target.value })} />
          </div>
          <div>
            <label className="field-label">STRN</label>
            <input className="field-input" value={form.strn || ''} onChange={(e) => setForm({ ...form, strn: e.target.value })} />
          </div>
          <div>
            <label className="field-label">FBR POS ID</label>
            <input className="field-input" value={form.fbrPosId || ''} onChange={(e) => setForm({ ...form, fbrPosId: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Currency</label>
            <select className="field-input" value={form.currency || 'PKR'} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Timezone</label>
            <input className="field-input" value={form.timezone || ''} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
        </div>
      </fieldset>
      {canManage && (
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      )}
      </div>
    </form>
  );
}

function BranchesTab({ canManage }) {
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
    if (!window.confirm(`Remove branch "${branch.name}"? Its sales history stays intact, but it will no longer appear anywhere new.`)) return;
    try {
      await api.del(`/org/branches/${branch._id}`);
      toast('Branch removed.', 'success');
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
            <p className="font-display text-lg font-semibold text-ink">Branches</p>
            <p className="text-sm text-ink-muted max-w-md mt-0.5">Every branch gets its own warehouse and POS counter automatically, so it's ready to sell from as soon as it's created.</p>
          </div>
          {canManage && (
            <button className="btn-primary flex items-center gap-1.5 shrink-0" onClick={() => setEditing({})}>
              <Plus size={14} /> New branch
            </button>
          )}
        </div>

        {loading && <div className="p-5"><Loading /></div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-sunken border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Address</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{b.name}</td>
                  <td className="px-4 py-3 text-ink-muted num">{b.code || '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{b.address || '—'}</td>
                  <td className="px-4 py-3 text-ink-muted num">{b.phone || '—'}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className="text-ink-muted hover:text-accent-strong" onClick={() => setEditing(b)} aria-label="Edit branch">
                          <Pencil size={15} />
                        </button>
                        <button className="text-ink-muted hover:text-danger" onClick={() => handleRemove(b)} aria-label="Remove branch">
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
        toast('Branch created.', 'success');
      } else {
        await api.put(`/org/branches/${branch._id}`, form);
        toast('Branch updated.', 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-4">{isNew ? 'New branch' : 'Edit branch'}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch name</label>
            <input required autoFocus placeholder="Gulberg Branch" className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Code</label>
            <input placeholder="LHR-02" className="field-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Address</label>
            <input className="field-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : isNew ? 'Create' : 'Save'}</button>
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
    if (!window.confirm(`Send ${formatMoney(taxPayment.amountDue, company?.currency)} to FBR via JazzCash for "${taxPayment.periodLabel}"?`)) return;
    setPayingId(taxPayment._id);
    try {
      const result = await api.post(`/tax-payments/${taxPayment._id}/pay`, {});
      if (result.taxPayment.status === 'paid') {
        toast('Tax payment completed via JazzCash.', 'success');
      } else if (result.taxPayment.status === 'failed') {
        toast(result.responseMessage || 'JazzCash declined the payment.', 'error');
      } else {
        toast('Payment initiated — awaiting confirmation from JazzCash.', 'success');
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
            <p className="font-display text-lg font-semibold text-ink">Tax liabilities</p>
            <p className="text-sm text-ink-muted max-w-md mt-0.5">Record what you owe each period, then pay it online via JazzCash straight to the FBR-designated account.</p>
          </div>
          {canManage && (
            <button className="btn-primary flex items-center gap-1.5 shrink-0" onClick={() => setShowNewForm(true)}>
              <Plus size={14} /> Record liability
            </button>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-sunken border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold">Period</th>
              <th className="px-4 py-3 font-semibold">Authority</th>
              <th className="px-4 py-3 font-semibold text-right">Amount due</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-muted">No tax liabilities recorded yet.</td></tr>
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
                          <Send size={13} /> {payingId === p._id ? 'Paying…' : 'Pay via JazzCash'}
                        </button>
                      ) : (
                        <span className="text-xs text-ink-muted">Paid {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : ''}</span>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {canManage && !company.jazzCashTaxPay?.enabled && payments.length > 0 && (
          <p className="text-xs text-ink-muted bg-surface-sunken px-5 py-3 border-t border-rule">Add your JazzCash tax-pay credentials above and enable them to pay these online.</p>
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
  const toast = useToast();
  const [form, setForm] = useState({ periodLabel: '', taxAuthority: 'fbr', amountDue: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tax-payments', {
        periodLabel: form.periodLabel,
        taxAuthority: form.taxAuthority,
        amountDue: Number(form.amountDue),
      });
      toast('Tax liability recorded.', 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-4">Record tax liability</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Period</label>
            <input required autoFocus placeholder="August 2026" className="field-input" value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Authority</label>
            <select className="field-input" value={form.taxAuthority} onChange={(e) => setForm({ ...form, taxAuthority: e.target.value })}>
              {['fbr', 'srb', 'pra', 'kpra', 'bra'].map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Amount due</label>
            <input required type="number" min="0.01" step="0.01" className="field-input" value={form.amountDue} onChange={(e) => setForm({ ...form, amountDue: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Record'}</button>
        </div>
      </form>
    </div>
  );
}

/** Lets the vendor plug in their own JazzCash merchant credentials for paying tax liability — kept distinct from any JazzCash config used for POS checkout since this is per-tenant, not platform-wide. */
function JazzCashTaxPayCredentials({ company, canManage, onSaved }) {
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

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put('/org/company', { jazzCashTaxPay: form });
      onSaved(updated);
      toast('JazzCash tax-pay settings saved.', 'success');
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
        <p className="font-display text-lg font-semibold text-ink">JazzCash tax-pay credentials</p>
      </div>
      <div className="p-5 space-y-4">
        {!canManage && (
          <p className="text-xs text-ink-muted bg-surface-sunken rounded-lg px-3 py-2">You can view this configuration, but only an admin can change it.</p>
        )}
        <fieldset disabled={!canManage} className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Enable paying tax liability online via JazzCash
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">JazzCash Merchant ID</label>
              <input className="field-input" value={form.merchantId} onChange={(e) => setForm({ ...form, merchantId: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input type="password" autoComplete="new-password" className="field-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Integrity Salt</label>
            <input type="password" autoComplete="new-password" className="field-input" value={form.integritySalt} onChange={(e) => setForm({ ...form, integritySalt: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">FBR account number</label>
              <input className="field-input" value={form.fbrAccountNumber} onChange={(e) => setForm({ ...form, fbrAccountNumber: e.target.value })} />
            </div>
            <div>
              <label className="field-label">FBR account title</label>
              <input className="field-input" value={form.fbrAccountTitle} onChange={(e) => setForm({ ...form, fbrAccountTitle: e.target.value })} />
            </div>
          </div>
        </fieldset>
        {canManage && (
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save credentials'}</button>
          </div>
        )}
      </div>
    </form>
  );
}
