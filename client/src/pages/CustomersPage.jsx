import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';
import { FieldError, errorInputClass } from '../components/FieldError';
import { validate, validateRequired, validateEmail, validatePkPhone, validateNonNegativeNumber, hasErrors, isBlank } from '../lib/validation';

export function CustomersPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit

  function load() {
    setLoading(true);
    api.get('/customers').then(setCustomers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="eyebrow mb-1">{t('customers.directory')}</p>
            <p className="page-title">{t('customers.title')}</p>
          </div>
          <button className="btn-primary" onClick={() => setEditing({})}>{t('customers.newCustomer')}</button>
        </div>
        <p className="text-sm text-ink-muted mb-5">{t('customers.onFile', { count: customers.length })}</p>

        {loading && <Loading />}
        {!loading && customers.length === 0 && (
          <EmptyState title={t('customers.emptyTitle')} description={t('customers.emptyDescription')} action={<button className="btn-primary" onClick={() => setEditing({})}>{t('customers.addCustomer')}</button>} />
        )}

        {!loading && customers.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                    <th className="px-4 py-3 font-semibold">{t('customers.colCustomer')}</th>
                    <th className="px-4 py-3 font-semibold">{t('customers.colContact')}</th>
                    <th className="px-4 py-3 font-semibold">{t('customers.colTags')}</th>
                    <th className="px-4 py-3 font-semibold text-right">{t('customers.colLoyaltyPts')}</th>
                    <th className="px-4 py-3 font-semibold text-right">{t('customers.colStatus')}</th>
                    <th className="px-4 py-3 font-semibold text-right">{t('customers.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const initials = (c.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
                    const isSelected = selected?._id === c._id;
                    return (
                      <tr key={c._id} className={`border-b border-rule last:border-0 hover:bg-paper transition-colors ${isSelected ? 'bg-accent-soft/40' : ''}`}>
                        <td className="px-4 py-3 cursor-pointer" onClick={() => setSelected(c)}>
                          <div className="flex items-center gap-3">
                            <span className="shrink-0 w-9 h-9 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-xs font-bold">
                              {initials || '?'}
                            </span>
                            <span className="font-medium text-ink">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 cursor-pointer" onClick={() => setSelected(c)}>
                          <div className="flex flex-col">
                            <span className="num text-ink-muted">{c.phone || '-'}</span>
                            {c.email && <span className="text-xs text-ink-muted">{c.email}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 cursor-pointer" onClick={() => setSelected(c)}>
                          <div className="flex flex-wrap gap-1">
                            {c.tags?.length ? c.tags.map((t) => <span key={t} className="chip-neutral">{t}</span>) : <span className="text-ink-muted text-xs">-</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 num text-right cursor-pointer" onClick={() => setSelected(c)}>{c.loyaltyPoints}</td>
                        <td className="px-4 py-3 text-right cursor-pointer" onClick={() => setSelected(c)}>
                          <span className={c.creditLimit > 0 ? 'chip-accent' : 'chip-neutral'}>{c.creditLimit > 0 ? t('customers.creditCustomer') : t('customers.standard')}</span>
                        </td>
                        <td className="px-4 py-3 text-right"><button className="btn-ghost !text-ink-muted !px-2 text-xs" onClick={() => setEditing(c)}>{t('common.edit')}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selected && <CustomerLedgerPanel customer={selected} onClose={() => setSelected(null)} />}
      {editing !== null && <CustomerForm customer={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function CustomerForm({ customer, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !customer._id;
  const [form, setForm] = useState({
    name: customer.name || '', phone: customer.phone || '', email: customer.email || '',
    address: customer.address || '', creditLimit: customer.creditLimit ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});

  const rules = {
    name: (v) => validateRequired(v, 'Name'),
    phone: (v) => (isBlank(v) ? null : validatePkPhone(v, { required: false })),
    email: (v) => (isBlank(v) ? null : validateEmail(v, { required: false })),
    creditLimit: (v) => validateNonNegativeNumber(v, 'Credit limit', { required: false }),
  };
  const errors = validate(form, rules);

  function markTouched(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, phone: true, email: true, creditLimit: true });
    if (hasErrors(errors)) return;
    setSaving(true);
    try {
      const payload = { ...form, creditLimit: Number(form.creditLimit) || 0 };
      if (isNew) {
        await api.post('/customers', payload);
        toast(t('customers.customerAdded'), 'success');
      } else {
        await api.put(`/customers/${customer._id}`, payload);
        toast(t('customers.customerUpdated'), 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-[2px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="eyebrow mb-1">{isNew ? t('customers.addCustomerTitle') : t('customers.editCustomerTitle')}</p>
        <p className="font-display text-lg font-semibold mb-4">{isNew ? t('customers.newCustomerTitle') : customer.name}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('customers.fieldName')}</label>
            <input
              required autoFocus maxLength={150}
              className={`field-input ${errorInputClass(touched.name && errors.name)}`}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => markTouched('name')}
              aria-invalid={Boolean(touched.name && errors.name)}
            />
            <FieldError message={touched.name ? errors.name : null} />
          </div>
          <div>
            <label className="field-label">{t('customers.fieldPhone')}</label>
            <input
              type="tel" inputMode="numeric" placeholder={t('customers.phonePlaceholder')} maxLength={11}
              className={`field-input ${errorInputClass(touched.phone && errors.phone)}`}
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              onBlur={() => markTouched('phone')}
              aria-invalid={Boolean(touched.phone && errors.phone)}
            />
            <FieldError message={touched.phone ? errors.phone : null} />
          </div>
          <div>
            <label className="field-label">{t('customers.fieldEmail')}</label>
            <input
              type="email" maxLength={254}
              className={`field-input ${errorInputClass(touched.email && errors.email)}`}
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => markTouched('email')}
              aria-invalid={Boolean(touched.email && errors.email)}
            />
            <FieldError message={touched.email ? errors.email : null} />
          </div>
          <div><label className="field-label">{t('customers.fieldAddress')}</label><input className="field-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div>
            <label className="field-label">{t('customers.fieldCreditLimit')}</label>
            <input
              type="number" min="0"
              className={`field-input num ${errorInputClass(touched.creditLimit && errors.creditLimit)}`}
              value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              onBlur={() => markTouched('creditLimit')}
              aria-invalid={Boolean(touched.creditLimit && errors.creditLimit)}
            />
            <FieldError message={touched.creditLimit ? errors.creditLimit : null} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving || hasErrors(errors)} className="btn-primary">{saving ? t('common.saving') : t('common.save')}</button>
        </div>
      </form>
    </div>
  );
}

function CustomerLedgerPanel({ customer, onClose }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [creditNotes, setCreditNotes] = useState([]);

  function load() {
    setLoading(true);
    api.get(`/customers/${customer._id}/ledger`).then(setLedger).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
    api.get(`/credit-notes?customerId=${customer._id}`).then(setCreditNotes).catch(() => {});
  }
  useEffect(() => { load(); api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {}); }, [customer._id]);

  async function recordPayment() {
    if (!paymentAmount || !paymentAccountId) return;
    setBusy(true);
    try {
      await api.post(`/customers/${customer._id}/payments`, { amount: Number(paymentAmount), paymentAccountId, date: new Date().toISOString() });
      toast(t('customers.paymentRecorded'), 'success');
      setPaymentAmount('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="eyebrow mb-0.5">{t('customers.ledger')}</p>
          <p className="font-display text-lg font-semibold">{customer.name}</p>
        </div>
        <button className="btn-ghost !px-2 text-xs" onClick={onClose}>{t('common.close')}</button>
      </div>

      <InvitePortalButton customer={customer} />

      {loading && <Loading />}
      {ledger && (
        <>
          <div className="space-y-1.5 text-sm max-h-64 overflow-y-auto mb-3">
            {ledger.entries.length === 0 && <p className="text-ink-muted">{t('customers.noTransactions')}</p>}
            {ledger.entries.map((e, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-ink-muted">{formatDate(e.date)}: {e.type === 'sale' ? t('customers.invLabel', { ref: e.reference }) : e.type === 'sale_payment' ? t('customers.paidAtSale', { ref: e.reference }) : t('customers.payment')}</span>
                <span className={`num ${e.type === 'sale' ? 'text-ink' : 'text-accent-strong'}`}>
                  {e.type === 'sale' ? '+' : '−'}{formatMoney(e.type === 'sale' ? e.debit : e.credit, company?.currency)}
                </span>
              </div>
            ))}
          </div>
          <div className="tear-line my-2" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">{t('customers.balanceOwed')}</span>
            <span className={ledger.closingBalance > 0 ? 'chip-warning' : 'chip-accent'}>
              <span className="num">{formatMoney(ledger.closingBalance, company?.currency)}</span>
            </span>
          </div>

          <p className="text-sm font-semibold mb-2">{t('customers.recordAPayment')}</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="number" placeholder={t('customers.amountPlaceholder')} className="field-input num" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            <select className="field-input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
              <option value="">{t('customers.accountPlaceholder')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn-primary w-full" disabled={busy || !paymentAmount || !paymentAccountId} onClick={recordPayment}>
            {busy ? t('common.recording') : t('customers.recordPayment')}
          </button>
          <p className="text-xs text-ink-muted mt-2">{t('customers.autoAllocatedHint')}</p>

          <div className="tear-line my-3" />
          <LoyaltyRedeem customer={customer} />

          <div className="tear-line my-3" />
          <CreditNoteHistory creditNotes={creditNotes} onVoided={load} />
        </>
      )}
    </div>
  );
}

function CreditNoteHistory({ creditNotes, onVoided }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  async function voidNote(id) {
    setBusyId(id);
    try {
      await api.post(`/credit-notes/${id}/void`, {});
      toast(t('customers.creditNoteVoided'), 'success');
      onVoided();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const STATUS_CHIP = { issued: 'chip-warning', applied: 'chip-accent', void: 'chip-danger' };

  return (
    <div>
      <p className="text-sm font-semibold mb-2">{t('customers.creditNotes')}</p>
      {creditNotes.length === 0 && <p className="text-xs text-ink-muted">{t('customers.noCreditNotes')}</p>}
      <div className="space-y-1.5 text-sm max-h-56 overflow-y-auto">
        {creditNotes.map((cn) => (
          <div key={cn._id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="num font-medium truncate">{cn.noteNumber}</p>
              {cn.reason && <p className="text-xs text-ink-muted truncate">{cn.reason}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="num">{formatMoney(cn.amount, company?.currency)}</span>
              <span className={STATUS_CHIP[cn.status] || 'chip-neutral'}>{cn.status}</span>
              {cn.status === 'issued' && (
                <button className="btn-ghost !text-danger !px-1.5 text-xs" disabled={busyId === cn._id} onClick={() => voidNote(cn._id)}>
                  {busyId === cn._id ? '…' : t('customers.void')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoyaltyRedeem({ customer }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [points, setPoints] = useState('');
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);

  async function redeem() {
    if (!points) return;
    setBusy(true);
    try {
      const result = await api.post(`/loyalty/customers/${customer._id}/redeem`, { points: Number(points) });
      setQuote(result);
      toast(t('customers.loyaltyReserved'), 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium mb-1">{t('customers.redeemLoyalty')}</p>
      <p className="text-xs text-ink-muted mb-2">{t('customers.loyaltyAvailable', { count: customer.loyaltyPoints })}</p>
      <div className="flex gap-2">
        <input type="number" min="1" max={customer.loyaltyPoints} placeholder={t('customers.pointsPlaceholder')} className="field-input num" value={points} onChange={(e) => setPoints(e.target.value)} />
        <button className="btn-secondary" disabled={busy || !points} onClick={redeem}>{busy ? t('customers.quoting') : t('customers.quote')}</button>
      </div>
      {quote && (
        <p className="text-sm mt-2">{t('customers.discountValueFor', { value: quote.discountValue, points: quote.points })}</p>
      )}
    </div>
  );
}

function InvitePortalButton({ customer }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState(customer.email || '');
  const [inviteLink, setInviteLink] = useState('');
  const [sending, setSending] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();
    setSending(true);
    try {
      const result = await api.post('/portal/invite', { customerId: customer._id, email });
      // No email provider is wired up yet, so the invite link is shown
      // directly here to copy/send manually — see portalController.js.
      setInviteLink(`${window.location.origin}/portal/activate?token=${result.inviteToken}`);
      toast(t('customers.portalInviteCreated'), 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  if (!showForm) {
    return <button className="text-xs font-semibold text-accent mb-3 hover:underline" onClick={() => setShowForm(true)}>{t('customers.invitePortal')}</button>;
  }

  return (
    <div className="mb-3 p-3 border border-rule rounded-lg bg-surface-sunken/50">
      {!inviteLink ? (
        <form onSubmit={handleInvite} className="space-y-2">
          <label className="field-label">{t('customers.portalEmail')}</label>
          <input type="email" required className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
            <button type="submit" disabled={sending} className="btn-primary text-xs">{sending ? t('customers.sending') : t('customers.createInvite')}</button>
          </div>
        </form>
      ) : (
        <div>
          <p className="text-xs text-ink-muted mb-1">{t('customers.sendActivationLink')}</p>
          <input readOnly className="field-input text-xs" value={inviteLink} onClick={(e) => e.target.select()} />
          <button className="text-xs text-accent mt-2" onClick={() => { setShowForm(false); setInviteLink(''); }}>{t('customers.done')}</button>
        </div>
      )}
    </div>
  );
}
