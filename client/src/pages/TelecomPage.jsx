import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const STATUS_CHIP = { active: 'chip-accent', suspended: 'chip-warning', cancelled: 'chip-danger' };

export function TelecomPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('subscriptions');
  return (
    <div>
      <p className="eyebrow mb-1">{t('telecom.eyebrow')}</p>
      <p className="page-title mb-4">{t('telecom.title')}</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['subscriptions', t('telecom.subscriptions')], ['plans', t('telecom.plans')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'subscriptions' ? <SubscriptionsTab /> : <PlansTab />}
    </div>
  );
}

function SubscriptionsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/telecom/subscriptions').then(setSubs).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-ink-muted">{subs.length === 1 ? t('telecom.subscriptionCountOne', { count: subs.length }) : t('telecom.subscriptionCountOther', { count: subs.length })}</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <span className="font-icon text-base leading-none">add</span>
            {t('telecom.newSubscription')}
          </button>
        </div>
        {loading && <Loading />}
        {!loading && subs.length === 0 && <EmptyState title={t('telecom.noSubscriptionsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('telecom.subscribeACustomer')}</button>} />}
        {!loading && subs.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                  <th className="px-4 py-2.5 font-semibold">{t('telecom.customer')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('telecom.plan')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('telecom.usedThisPeriod')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('telecom.status')}</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s._id} onClick={() => setSelected(s)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper transition-colors ${selected?._id === s._id ? 'bg-accent-soft' : ''}`}>
                    <td className="px-4 py-3 font-medium text-ink">{s.customerId?.name || '-'}</td>
                    <td className="px-4 py-3 text-ink-muted">{s.planId?.name || '-'}</td>
                    <td className="px-4 py-3 text-ink-muted num">{t('telecom.usageSummary', { minutes: s.usedMinutes, data: s.usedDataMB, sms: s.usedSms })}</td>
                    <td className="px-4 py-3"><span className={STATUS_CHIP[s.status]}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <SubscriptionPanel subscription={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <SubscriptionForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function SubscriptionForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ branchId: '', customerId: '', planId: '', warehouseId: '', paymentAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/telecom/plans').then(setPlans).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/telecom/subscriptions', form);
      toast(t('telecom.subscriptionCreated'), 'success');
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
        <p className="font-display text-lg font-semibold mb-4">{t('telecom.newSubscription')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('telecom.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, warehouseId: '' })}>
              <option value="">{t('telecom.select')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('telecom.customer')}</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('telecom.select')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('telecom.plan')}</label>
            <select required className="field-input" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
              <option value="">{t('telecom.select')}</option>
              {plans.map((p) => <option key={p._id} value={p._id}>{p.name}: {formatMoney(p.monthlyFee)}/mo</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('telecom.warehouseForSale')}</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">{t('telecom.select')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('telecom.paymentAccount')}</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">{t('telecom.select')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('telecom.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('telecom.creating') : t('telecom.subscribe')}</button>
        </div>
      </form>
    </div>
  );
}

function SubscriptionPanel({ subscription, onClose, onChanged }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [usage, setUsage] = useState({ minutes: '', dataMB: '', sms: '' });
  const [warehouseId, setWarehouseId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (subscription.branchId) api.get(`/org/warehouses?branchId=${subscription.branchId}`).then(setWarehouses).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, [subscription._id]);

  async function recordUsage(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/telecom/subscriptions/${subscription._id}/usage`, {
        minutes: usage.minutes ? Number(usage.minutes) : undefined,
        dataMB: usage.dataMB ? Number(usage.dataMB) : undefined,
        sms: usage.sms ? Number(usage.sms) : undefined,
      });
      toast(t('telecom.usageRecorded'), 'success');
      setUsage({ minutes: '', dataMB: '', sms: '' });
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function generateBill() {
    setBusy(true);
    try {
      const result = await api.post(`/telecom/subscriptions/${subscription._id}/bill`, { warehouseId, paymentAccountId });
      toast(t('telecom.billedSummary', { total: formatMoney(result.usageSummary.totalBilled, company?.currency), overage: formatMoney(result.usageSummary.overageCost, company?.currency) }), 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-1">
        <p className="font-display text-lg font-semibold">{subscription.customerId?.name}</p>
        <button className="btn-ghost !px-2 !py-1 text-sm" onClick={onClose}>{t('telecom.close')}</button>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className={STATUS_CHIP[subscription.status]}>{subscription.status}</span>
        <p className="text-sm text-ink-muted">{subscription.planId?.name}: {t('telecom.usageSummary', { minutes: subscription.usedMinutes, data: subscription.usedDataMB, sms: subscription.usedSms })} {t('telecom.used')}</p>
      </div>

      {subscription.status === 'active' && (
        <>
          <form onSubmit={recordUsage} className="mb-4">
            <p className="eyebrow mb-2">{t('telecom.recordUsage')}</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input type="number" min="0" className="field-input num" placeholder={t('telecom.minutes')} value={usage.minutes} onChange={(e) => setUsage({ ...usage, minutes: e.target.value })} />
              <input type="number" min="0" className="field-input num" placeholder={t('telecom.dataMB')} value={usage.dataMB} onChange={(e) => setUsage({ ...usage, dataMB: e.target.value })} />
              <input type="number" min="0" className="field-input num" placeholder={t('telecom.sms')} value={usage.sms} onChange={(e) => setUsage({ ...usage, sms: e.target.value })} />
            </div>
            <button type="submit" disabled={busy} className="btn-secondary w-full">{t('telecom.addUsage')}</button>
          </form>

          <div className="tear-line my-3" />
          <p className="eyebrow mb-2">{t('telecom.generateMonthlyBill')}</p>
          <div className="space-y-2 mb-2">
            <select className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{t('telecom.warehouseForSaleEllipsis')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
            <select className="field-input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
              <option value="">{t('telecom.paymentAccountEllipsis')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn-primary w-full" disabled={!warehouseId || !paymentAccountId || busy} onClick={generateBill}>
            {busy ? t('telecom.billing') : t('telecom.billPeriodAndReset')}
          </button>
        </>
      )}
    </div>
  );
}

function PlansTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/telecom/plans').then(setPlans).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-ink-muted">{plans.length === 1 ? t('telecom.planCountOne', { count: plans.length }) : t('telecom.planCountOther', { count: plans.length })}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-base leading-none">add</span>
          {t('telecom.newPlan')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && plans.length === 0 && <EmptyState title={t('telecom.noPlansYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('telecom.createOne')}</button>} />}
      {!loading && plans.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {plans.map((p) => (
            <div key={p._id} className="card p-4">
              <p className="text-sm font-semibold text-ink">{p.name}</p>
              <p className="num text-lg font-display font-semibold text-accent-strong mt-1">{formatMoney(p.monthlyFee)}<span className="text-xs font-sans font-normal text-ink-muted">/mo</span></p>
              <p className="text-xs text-ink-muted mt-1 num">{t('telecom.includedSummary', { minutes: p.includedMinutes, data: p.includedDataMB, sms: p.includedSms })}</p>
            </div>
          ))}
        </div>
      )}
      {showForm && <PlanForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function PlanForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', monthlyFee: '', includedMinutes: 0, includedDataMB: 0, includedSms: 0, overageRatePerMinute: 0, overageRatePerMB: 0, overageRatePerSms: 0, billingProductId: '', overageBillingProductId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const billingProduct = products.find((p) => p._id === form.billingProductId);
      const overageProduct = products.find((p) => p._id === form.overageBillingProductId);
      if (!billingProduct || !overageProduct) throw new Error(t('telecom.bothBillingProductsError'));
      await api.post('/telecom/plans', {
        ...form,
        monthlyFee: Number(form.monthlyFee), includedMinutes: Number(form.includedMinutes), includedDataMB: Number(form.includedDataMB), includedSms: Number(form.includedSms),
        overageRatePerMinute: Number(form.overageRatePerMinute), overageRatePerMB: Number(form.overageRatePerMB), overageRatePerSms: Number(form.overageRatePerSms),
        billingVariantId: billingProduct.variants[0]?._id, overageBillingVariantId: overageProduct.variants[0]?._id,
      });
      toast(t('telecom.planCreated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-semibold mb-4">{t('telecom.newPlan')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('telecom.name')}</label><input required className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('telecom.namePlaceholder')} /></div>
          <div><label className="field-label">{t('telecom.monthlyFee')}</label><input type="number" required className="field-input num" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} /></div>
          <p className="eyebrow">{t('telecom.includedQuotaOverageRate')}</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" className="field-input num" placeholder={t('telecom.minutesIncluded')} value={form.includedMinutes} onChange={(e) => setForm({ ...form, includedMinutes: e.target.value })} />
            <input type="number" min="0" step="0.01" className="field-input num" placeholder={t('telecom.ratePerMin')} value={form.overageRatePerMinute} onChange={(e) => setForm({ ...form, overageRatePerMinute: e.target.value })} />
            <input type="number" min="0" className="field-input num" placeholder={t('telecom.dataMBIncluded')} value={form.includedDataMB} onChange={(e) => setForm({ ...form, includedDataMB: e.target.value })} />
            <input type="number" min="0" step="0.01" className="field-input num" placeholder={t('telecom.ratePerMB')} value={form.overageRatePerMB} onChange={(e) => setForm({ ...form, overageRatePerMB: e.target.value })} />
            <input type="number" min="0" className="field-input num" placeholder={t('telecom.smsIncluded')} value={form.includedSms} onChange={(e) => setForm({ ...form, includedSms: e.target.value })} />
            <input type="number" min="0" step="0.01" className="field-input num" placeholder={t('telecom.ratePerSms')} value={form.overageRatePerSms} onChange={(e) => setForm({ ...form, overageRatePerSms: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('telecom.planFeeBillingProduct')}</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}>
              <option value="">{t('telecom.select')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('telecom.overageBillingProduct')}</label>
            <select required className="field-input" value={form.overageBillingProductId} onChange={(e) => setForm({ ...form, overageBillingProductId: e.target.value })}>
              <option value="">{t('telecom.select')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('telecom.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('telecom.creating') : t('telecom.createPlan')}</button>
        </div>
      </form>
    </div>
  );
}
