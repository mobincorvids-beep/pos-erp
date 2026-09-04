import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDate, formatMoney } from '../lib/format';

const STATUS_CHIP = { active: 'chip-accent', redeemed: 'chip-neutral', expired: 'chip-warning', cancelled: 'chip-danger' };

export function LoyaltyPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [tab, setTab] = useState('loyalty');

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">{t('loyalty.salesHub')}</p>
          <h1 className="page-title">{t('loyalty.title')}</h1>
        </div>
      </div>

      <div className="flex gap-1 border-b border-rule mb-6">
        {[['loyalty', t('loyalty.loyaltyProgram')], ['gift_cards', t('loyalty.giftCards')], ['coupons', t('loyalty.coupons')]].map(([key, label]) => (
          <button
            key={key} onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'loyalty' && <LoyaltyProgramTab can={can} />}
      {tab === 'gift_cards' && <GiftCardsTab can={can} />}
      {tab === 'coupons' && <CouponsTab can={can} />}
    </div>
  );
}

function LoyaltyProgramTab({ can }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [program, setProgram] = useState(null);
  const [form, setForm] = useState({ earnRate: '', redemptionValue: '', minRedeemPoints: '', isActive: true });
  const [saving, setSaving] = useState(false);

  function load() {
    api.get('/loyalty/program').then((p) => {
      setProgram(p);
      if (p) setForm({ earnRate: p.earnRate, redemptionValue: p.redemptionValue, minRedeemPoints: p.minRedeemPoints, isActive: p.isActive });
    }).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/loyalty/program', {
        earnRate: Number(form.earnRate), redemptionValue: Number(form.redemptionValue),
        minRedeemPoints: Number(form.minRedeemPoints), isActive: form.isActive,
      });
      toast(t('loyalty.programSaved'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-muted max-w-2xl">{t('loyalty.programDescription')}</p>
        {program && (
          program.isActive
            ? <span className="chip-accent">{t('loyalty.active')}</span>
            : <span className="chip-neutral">{t('loyalty.inactive')}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <form onSubmit={save} className="card p-6">
          <p className="text-sm font-semibold text-ink mb-4">{t('loyalty.programSettings')}</p>
          <div className="space-y-4">
            <div>
              <label className="field-label">{t('loyalty.pointsEarnedPerUnit')}</label>
              <input type="number" step="0.01" className="field-input num" value={form.earnRate} onChange={(e) => setForm({ ...form, earnRate: e.target.value })} disabled={!can('loyalty.manage')} placeholder={t('loyalty.earnRatePlaceholder')} />
            </div>
            <div>
              <label className="field-label">{t('loyalty.redemptionValuePerPoint')}</label>
              <input type="number" step="0.01" className="field-input num" value={form.redemptionValue} onChange={(e) => setForm({ ...form, redemptionValue: e.target.value })} disabled={!can('loyalty.manage')} />
            </div>
            <div>
              <label className="field-label">{t('loyalty.minimumPointsToRedeem')}</label>
              <input type="number" className="field-input num" value={form.minRedeemPoints} onChange={(e) => setForm({ ...form, minRedeemPoints: e.target.value })} disabled={!can('loyalty.manage')} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} disabled={!can('loyalty.manage')} />
              {t('loyalty.programActive')}
            </label>
          </div>
          {can('loyalty.manage') && (
            <button type="submit" disabled={saving} className="btn-primary w-full mt-6">{saving ? t('loyalty.saving') : t('loyalty.saveProgram')}</button>
          )}
        </form>

        <div className="rounded-xl bg-accent text-white p-6 shadow-sm">
          <p className="text-sm font-semibold mb-3">{t('loyalty.howItWorks')}</p>
          <ul className="text-sm text-white/80 space-y-3">
            <li className="flex gap-2">
              <span className="mt-0.5">•</span>
              <span>{t('loyalty.howItWorksPoint1')}</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5">•</span>
              <span>{t('loyalty.howItWorksPoint2')}</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5">•</span>
              <span>{t('loyalty.howItWorksPoint3')}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function GiftCardsTab({ can }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { company } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [justIssued, setJustIssued] = useState(null); // the freshly-created card, shown once so its number can be captured

  function load() {
    setLoading(true);
    const query = statusFilter ? `?status=${statusFilter}` : '';
    api.get(`/gift-cards${query}`).then(setCards).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <p className="text-sm text-ink-muted max-w-2xl">{t('loyalty.giftCardsDescription')}</p>
        {can('gift_cards.manage') && (
          <button className="btn-primary shrink-0" onClick={() => setShowIssueForm(true)}>{t('loyalty.issueGiftCard')}</button>
        )}
      </div>

      <GiftCardLookupTool />

      <div className="flex gap-1 border-b border-rule">
        {[['', t('loyalty.all')], ['active', t('loyalty.active')], ['redeemed', t('loyalty.redeemed')], ['expired', t('loyalty.expired')], ['cancelled', t('loyalty.cancelled')]].map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${statusFilter === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-ink-muted">{t('loyalty.loading')}</p>}
      {!loading && cards.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-ink">{t('loyalty.noGiftCardsYet')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('loyalty.noGiftCardsYetDescription')}</p>
        </div>
      )}
      {!loading && cards.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="px-5 py-3 eyebrow font-medium">{t('loyalty.cardNumber')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('loyalty.customer')}</th>
                  <th className="px-5 py-3 eyebrow font-medium text-right">{t('loyalty.initial')}</th>
                  <th className="px-5 py-3 eyebrow font-medium text-right">{t('loyalty.balance')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('loyalty.status')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('loyalty.expires')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('loyalty.issued')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {cards.map((c) => (
                  <tr key={c._id} className="align-top">
                    <td className="px-5 py-4 num text-accent font-semibold">{c.cardNumber}</td>
                    <td className="px-5 py-4 text-ink-muted">{c.issuedToCustomerId?.name || '-'}</td>
                    <td className="px-5 py-4 num text-right text-ink-muted">{formatMoney(c.initialBalance, company?.currency)}</td>
                    <td className="px-5 py-4 num text-right font-semibold text-ink">{formatMoney(c.currentBalance, company?.currency)}</td>
                    <td className="px-5 py-4"><span className={STATUS_CHIP[c.status] || 'chip-neutral'}>{c.status}</span></td>
                    <td className="px-5 py-4 text-ink-muted">{c.expiresAt ? formatDate(c.expiresAt) : '-'}</td>
                    <td className="px-5 py-4 text-ink-muted">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showIssueForm && (
        <IssueGiftCardForm
          onClose={() => setShowIssueForm(false)}
          onIssued={(card) => { setShowIssueForm(false); setJustIssued(card); load(); }}
        />
      )}

      {justIssued && (
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
          <div className="card p-6 w-full max-w-sm text-center">
            <p className="eyebrow text-accent mb-2">{t('loyalty.giftCardIssued')}</p>
            <p className="num text-2xl font-bold text-ink tracking-widest mb-1">{justIssued.cardNumber}</p>
            <p className="text-sm text-ink-muted mb-4">{t('loyalty.balance')}: {formatMoney(justIssued.currentBalance, company?.currency)}</p>
            <p className="text-xs text-ink-muted mb-5">{t('loyalty.giftCardIssuedNote')}</p>
            <button className="btn-primary w-full" onClick={() => setJustIssued(null)}>{t('loyalty.done')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueGiftCardForm({ onClose, onIssued }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ initialBalance: '', customerId: '', expiresAt: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const card = await api.post('/gift-cards', {
        initialBalance: Number(form.initialBalance),
        customerId: form.customerId || undefined,
        expiresAt: form.expiresAt || undefined,
      });
      toast(t('loyalty.giftCardIssuedToast'), 'success');
      onIssued(card);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('loyalty.issueAGiftCard')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('loyalty.amount')}</label>
            <input required type="number" min="1" step="0.01" className="field-input num" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('loyalty.customerOptional')}</label>
            <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('loyalty.walkInUnassigned')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('loyalty.expiresOnOptional')}</label>
            <input type="date" className="field-input" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('loyalty.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('loyalty.issuing') : t('loyalty.issueCard')}</button>
        </div>
      </form>
    </div>
  );
}

/** Manual balance lookup: for a cashier checking a card without going through the POS checkout flow (e.g. a customer just asking what's left on it). */
function GiftCardLookupTool() {
  const { t } = useTranslation();
  const toast = useToast();
  const { company } = useAuth();
  const [cardNumber, setCardNumber] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  async function check() {
    if (!cardNumber.trim()) return;
    setChecking(true);
    try {
      const res = await api.get(`/gift-cards/${cardNumber.toUpperCase().trim()}/lookup`);
      setResult(res);
    } catch (err) {
      toast(err.message, 'error');
      setResult(null);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-ink mb-2">{t('loyalty.checkABalance')}</p>
      <div className="flex gap-2 max-w-md">
        <input
          type="text" placeholder={t('loyalty.giftCardNumber')} className="field-input flex-1"
          value={cardNumber} onChange={(e) => { setCardNumber(e.target.value.toUpperCase()); setResult(null); }}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={check} disabled={!cardNumber.trim() || checking}>
          {checking ? t('loyalty.checking') : t('loyalty.lookUp')}
        </button>
      </div>
      {result && (
        result.usable
          ? <p className="text-sm text-accent-strong mt-2">{t('loyalty.balance')}: {formatMoney(result.balance, company?.currency)}: {t('loyalty.usableAtCheckout')}</p>
          : <p className="text-sm text-danger mt-2">{result.reason}</p>
      )}
    </div>
  );
}

function CouponsTab({ can }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { company } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const manage = can('coupons.manage');

  function load() {
    setLoading(true);
    api.get('/coupons').then(setCoupons).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggleActive(coupon) {
    try {
      await api.patch(`/coupons/${coupon._id}/active`, { active: !coupon.active });
      toast(
        t('loyalty.couponToggled', { code: coupon.code, state: coupon.active ? t('loyalty.deactivated') : t('loyalty.activated') }),
        'success'
      );
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function isExpired(c) {
    return c.validUntil && new Date(c.validUntil) < new Date();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <p className="text-sm text-ink-muted max-w-2xl">{t('loyalty.couponsDescription')}</p>
        {manage && (
          <button className="btn-primary shrink-0" onClick={() => setShowForm(true)}>{t('loyalty.newCoupon')}</button>
        )}
      </div>

      {loading && <p className="text-sm text-ink-muted">{t('loyalty.loading')}</p>}
      {!loading && coupons.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-ink">{t('loyalty.noCouponsYet')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('loyalty.noCouponsYetDescription')}</p>
        </div>
      )}
      {!loading && coupons.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="px-5 py-3 eyebrow font-medium">{t('loyalty.code')}</th>
                  <th className="px-5 py-3 eyebrow font-medium text-right">{t('loyalty.discount')}</th>
                  <th className="px-5 py-3 eyebrow font-medium text-right">{t('loyalty.minPurchase')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('loyalty.usage')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('loyalty.validDates')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('loyalty.status')}</th>
                  {manage && <th className="px-5 py-3 eyebrow font-medium"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {coupons.map((c) => (
                  <tr key={c._id} className="align-top">
                    <td className="px-5 py-4 num font-semibold text-ink">{c.code}</td>
                    <td className="px-5 py-4 num text-right text-ink-muted">{c.discountType === 'percent' ? `${c.discountValue}%` : formatMoney(c.discountValue, company?.currency)}</td>
                    <td className="px-5 py-4 num text-right text-ink-muted">{c.minPurchaseAmount ? formatMoney(c.minPurchaseAmount, company?.currency) : '-'}</td>
                    <td className="px-5 py-4 num text-ink-muted">{c.usageCount}{c.maxUsageCount ? ` / ${c.maxUsageCount}` : ''} <span className="text-xs">({c.maxUsagePerCustomer}{t('loyalty.perCustomerSuffix')})</span></td>
                    <td className="px-5 py-4 text-xs text-ink-muted">{c.validFrom ? formatDate(c.validFrom) : '-'} – {c.validUntil ? formatDate(c.validUntil) : t('loyalty.noExpiry')}</td>
                    <td className="px-5 py-4">
                      {!c.active ? <span className="chip-neutral">{t('loyalty.inactive')}</span>
                        : isExpired(c) ? <span className="chip-warning">{t('loyalty.expired')}</span>
                        : <span className="chip-accent">{t('loyalty.active')}</span>}
                    </td>
                    {manage && (
                      <td className="px-5 py-4 text-right">
                        <button className="text-xs font-semibold text-accent-strong hover:underline" onClick={() => toggleActive(c)}>
                          {c.active ? t('loyalty.deactivate') : t('loyalty.activate')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <CouponFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CouponFormModal({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({
    code: '', description: '', discountType: 'percent', discountValue: '',
    minPurchaseAmount: '', maxUsageCount: '', maxUsagePerCustomer: '1',
    validFrom: '', validUntil: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/coupons', {
        code: form.code, description: form.description, discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minPurchaseAmount: form.minPurchaseAmount ? Number(form.minPurchaseAmount) : 0,
        maxUsageCount: form.maxUsageCount ? Number(form.maxUsageCount) : null,
        maxUsagePerCustomer: Number(form.maxUsagePerCustomer) || 1,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
      });
      toast(t('loyalty.couponCreated'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('loyalty.newCoupon')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('loyalty.code')}</label>
            <input required autoFocus className="field-input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={t('loyalty.codePlaceholder')} />
          </div>
          <div>
            <label className="field-label">{t('loyalty.descriptionOptional')}</label>
            <input className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('loyalty.descriptionPlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('loyalty.discountType')}</label>
              <select className="field-input" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
                <option value="percent">{t('loyalty.percent')}</option>
                <option value="fixed">{t('loyalty.fixedAmount')}</option>
              </select>
            </div>
            <div>
              <label className="field-label">{t('loyalty.discountValue')}</label>
              <input required type="number" step="0.01" min="0" className="field-input num" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">{t('loyalty.minimumPurchaseOptional')}</label>
            <input type="number" step="0.01" min="0" className="field-input num" value={form.minPurchaseAmount} onChange={(e) => setForm({ ...form, minPurchaseAmount: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('loyalty.maxTotalUses')}</label>
              <input type="number" min="1" className="field-input num" value={form.maxUsageCount} onChange={(e) => setForm({ ...form, maxUsageCount: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('loyalty.maxUsesPerCustomer')}</label>
              <input type="number" min="1" className="field-input num" value={form.maxUsagePerCustomer} onChange={(e) => setForm({ ...form, maxUsagePerCustomer: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('loyalty.validFromOptional')}</label>
              <input type="date" className="field-input" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('loyalty.validUntilOptional')}</label>
              <input type="date" className="field-input" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('loyalty.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('loyalty.creating') : t('loyalty.createCoupon')}</button>
        </div>
      </form>
    </div>
  );
}
