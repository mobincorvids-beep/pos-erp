import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDate, formatMoney } from '../lib/format';

const STATUS_CHIP = { active: 'chip-accent', redeemed: 'chip-neutral', expired: 'chip-warning', cancelled: 'chip-danger' };

export function LoyaltyPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('loyalty');

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Sales hub</p>
          <h1 className="page-title">Loyalty &amp; Gift Cards</h1>
        </div>
      </div>

      <div className="flex gap-1 border-b border-rule mb-6">
        {[['loyalty', 'Loyalty program'], ['gift_cards', 'Gift cards'], ['coupons', 'Coupons']].map(([key, label]) => (
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
      toast('Loyalty program saved.', 'success');
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
        <p className="text-sm text-ink-muted max-w-2xl">Points are earned automatically on checkout. Redeeming points happens from a customer's ledger: see the Customers page.</p>
        {program && (
          program.isActive
            ? <span className="chip-accent">Active</span>
            : <span className="chip-neutral">Inactive</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <form onSubmit={save} className="card p-6">
          <p className="text-sm font-semibold text-ink mb-4">Program settings</p>
          <div className="space-y-4">
            <div>
              <label className="field-label">Points earned per currency unit spent</label>
              <input type="number" step="0.01" className="field-input num" value={form.earnRate} onChange={(e) => setForm({ ...form, earnRate: e.target.value })} disabled={!can('loyalty.manage')} placeholder="e.g. 100 = 1 point per 100 spent" />
            </div>
            <div>
              <label className="field-label">Redemption value per point</label>
              <input type="number" step="0.01" className="field-input num" value={form.redemptionValue} onChange={(e) => setForm({ ...form, redemptionValue: e.target.value })} disabled={!can('loyalty.manage')} />
            </div>
            <div>
              <label className="field-label">Minimum points to redeem</label>
              <input type="number" className="field-input num" value={form.minRedeemPoints} onChange={(e) => setForm({ ...form, minRedeemPoints: e.target.value })} disabled={!can('loyalty.manage')} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} disabled={!can('loyalty.manage')} />
              Program active
            </label>
          </div>
          {can('loyalty.manage') && (
            <button type="submit" disabled={saving} className="btn-primary w-full mt-6">{saving ? 'Saving…' : 'Save program'}</button>
          )}
        </form>

        <div className="rounded-xl bg-accent text-white p-6 shadow-sm">
          <p className="text-sm font-semibold mb-3">How it works</p>
          <ul className="text-sm text-white/80 space-y-3">
            <li className="flex gap-2">
              <span className="mt-0.5">•</span>
              <span>Every completed sale with a customer attached earns points automatically after checkout, it never blocks or slows down the sale.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5">•</span>
              <span>A customer redeems points from their ledger panel (Customers page), which quotes a currency value and reserves the points.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5">•</span>
              <span>Since a sale only has per-line discounts (not one on the whole invoice), the redeemed value needs to be applied as a discount on the item lines at checkout.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function GiftCardsTab({ can }) {
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
        <p className="text-sm text-ink-muted max-w-2xl">Issue stored-value cards customers can redeem as a payment method at checkout. A card's number is generated automatically and shown once at issue time.</p>
        {can('gift_cards.manage') && (
          <button className="btn-primary shrink-0" onClick={() => setShowIssueForm(true)}>Issue gift card</button>
        )}
      </div>

      <GiftCardLookupTool />

      <div className="flex gap-1 border-b border-rule">
        {[['', 'All'], ['active', 'Active'], ['redeemed', 'Redeemed'], ['expired', 'Expired'], ['cancelled', 'Cancelled']].map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${statusFilter === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-ink-muted">Loading…</p>}
      {!loading && cards.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-ink">No gift cards yet</p>
          <p className="text-sm text-ink-muted mt-1">Issue one to sell it: the customer can redeem the balance at checkout on the POS page.</p>
        </div>
      )}
      {!loading && cards.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="px-5 py-3 eyebrow font-medium">Card number</th>
                  <th className="px-5 py-3 eyebrow font-medium">Customer</th>
                  <th className="px-5 py-3 eyebrow font-medium text-right">Initial</th>
                  <th className="px-5 py-3 eyebrow font-medium text-right">Balance</th>
                  <th className="px-5 py-3 eyebrow font-medium">Status</th>
                  <th className="px-5 py-3 eyebrow font-medium">Expires</th>
                  <th className="px-5 py-3 eyebrow font-medium">Issued</th>
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
            <p className="eyebrow text-accent mb-2">Gift card issued</p>
            <p className="num text-2xl font-bold text-ink tracking-widest mb-1">{justIssued.cardNumber}</p>
            <p className="text-sm text-ink-muted mb-4">Balance: {formatMoney(justIssued.currentBalance, company?.currency)}</p>
            <p className="text-xs text-ink-muted mb-5">Write this number on the physical card or send it to the customer, it won't be shown again from here, only looked up.</p>
            <button className="btn-primary w-full" onClick={() => setJustIssued(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueGiftCardForm({ onClose, onIssued }) {
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
      toast('Gift card issued.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">Issue a gift card</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Amount</label>
            <input required type="number" min="1" step="0.01" className="field-input num" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Customer (optional)</label>
            <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Walk-in / unassigned</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Expires on (optional)</label>
            <input type="date" className="field-input" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Issuing…' : 'Issue card'}</button>
        </div>
      </form>
    </div>
  );
}

/** Manual balance lookup: for a cashier checking a card without going through the POS checkout flow (e.g. a customer just asking what's left on it). */
function GiftCardLookupTool() {
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
      <p className="text-sm font-semibold text-ink mb-2">Check a balance</p>
      <div className="flex gap-2 max-w-md">
        <input
          type="text" placeholder="Gift card number" className="field-input flex-1"
          value={cardNumber} onChange={(e) => { setCardNumber(e.target.value.toUpperCase()); setResult(null); }}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={check} disabled={!cardNumber.trim() || checking}>
          {checking ? 'Checking…' : 'Look up'}
        </button>
      </div>
      {result && (
        result.usable
          ? <p className="text-sm text-accent-strong mt-2">Balance: {formatMoney(result.balance, company?.currency)}: usable at checkout.</p>
          : <p className="text-sm text-danger mt-2">{result.reason}</p>
      )}
    </div>
  );
}

function CouponsTab({ can }) {
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
      toast(`Coupon ${coupon.code} ${coupon.active ? 'deactivated' : 'activated'}.`, 'success');
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
        <p className="text-sm text-ink-muted max-w-2xl">Promo codes customers can enter at checkout for a percent or fixed discount, with optional usage limits and a validity window.</p>
        {manage && (
          <button className="btn-primary shrink-0" onClick={() => setShowForm(true)}>+ New coupon</button>
        )}
      </div>

      {loading && <p className="text-sm text-ink-muted">Loading…</p>}
      {!loading && coupons.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-ink">No coupons yet</p>
          <p className="text-sm text-ink-muted mt-1">Create one: a cashier can apply it by code on the POS checkout page.</p>
        </div>
      )}
      {!loading && coupons.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="px-5 py-3 eyebrow font-medium">Code</th>
                  <th className="px-5 py-3 eyebrow font-medium text-right">Discount</th>
                  <th className="px-5 py-3 eyebrow font-medium text-right">Min. purchase</th>
                  <th className="px-5 py-3 eyebrow font-medium">Usage</th>
                  <th className="px-5 py-3 eyebrow font-medium">Valid dates</th>
                  <th className="px-5 py-3 eyebrow font-medium">Status</th>
                  {manage && <th className="px-5 py-3 eyebrow font-medium"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {coupons.map((c) => (
                  <tr key={c._id} className="align-top">
                    <td className="px-5 py-4 num font-semibold text-ink">{c.code}</td>
                    <td className="px-5 py-4 num text-right text-ink-muted">{c.discountType === 'percent' ? `${c.discountValue}%` : formatMoney(c.discountValue, company?.currency)}</td>
                    <td className="px-5 py-4 num text-right text-ink-muted">{c.minPurchaseAmount ? formatMoney(c.minPurchaseAmount, company?.currency) : '-'}</td>
                    <td className="px-5 py-4 num text-ink-muted">{c.usageCount}{c.maxUsageCount ? ` / ${c.maxUsageCount}` : ''} <span className="text-xs">({c.maxUsagePerCustomer}/customer)</span></td>
                    <td className="px-5 py-4 text-xs text-ink-muted">{c.validFrom ? formatDate(c.validFrom) : '-'} – {c.validUntil ? formatDate(c.validUntil) : 'no expiry'}</td>
                    <td className="px-5 py-4">
                      {!c.active ? <span className="chip-neutral">Inactive</span>
                        : isExpired(c) ? <span className="chip-warning">Expired</span>
                        : <span className="chip-accent">Active</span>}
                    </td>
                    {manage && (
                      <td className="px-5 py-4 text-right">
                        <button className="text-xs font-semibold text-accent-strong hover:underline" onClick={() => toggleActive(c)}>
                          {c.active ? 'Deactivate' : 'Activate'}
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
      toast('Coupon created.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">New coupon</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Code</label>
            <input required autoFocus className="field-input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. SAVE10" />
          </div>
          <div>
            <label className="field-label">Description (optional)</label>
            <input className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. 10% off storewide" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Discount type</label>
              <select className="field-input" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
                <option value="percent">Percent</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div>
              <label className="field-label">Discount value</label>
              <input required type="number" step="0.01" min="0" className="field-input num" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Minimum purchase (optional)</label>
            <input type="number" step="0.01" min="0" className="field-input num" value={form.minPurchaseAmount} onChange={(e) => setForm({ ...form, minPurchaseAmount: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Max total uses (blank = unlimited)</label>
              <input type="number" min="1" className="field-input num" value={form.maxUsageCount} onChange={(e) => setForm({ ...form, maxUsageCount: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Max uses per customer</label>
              <input type="number" min="1" className="field-input num" value={form.maxUsagePerCustomer} onChange={(e) => setForm({ ...form, maxUsagePerCustomer: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Valid from (optional)</label>
              <input type="date" className="field-input" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Valid until (optional)</label>
              <input type="date" className="field-input" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create coupon'}</button>
        </div>
      </form>
    </div>
  );
}
