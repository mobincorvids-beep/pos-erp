import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function JewelryPage() {
  const { t } = useTranslation();
  const TABS = [
    ['rates', t('jewelry.goldRates'), 'payments'],
    ['items', t('jewelry.itemPricing'), 'sell'],
    ['buybacks', t('jewelry.buybacks'), 'sync_alt'],
  ];
  const [tab, setTab] = useState('rates');
  return (
    <div>
      <div className="mb-5">
        <p className="eyebrow mb-1">{t('jewelry.jewelryOperations')}</p>
        <p className="page-title">{t('jewelry.title')}</p>
      </div>
      <div className="flex gap-2 mb-6">
        {TABS.map(([key, label, icon]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            <span className="material-symbols-outlined text-sm mr-1.5">{icon}</span>
            {label}
          </button>
        ))}
      </div>
      {tab === 'rates' && <RatesTab />}
      {tab === 'items' && <ItemsTab />}
      {tab === 'buybacks' && <BuybacksTab />}
    </div>
  );
}

function RatesTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [rates, setRates] = useState([]);
  const [karat, setKarat] = useState(22);
  const [ratePerGram, setRatePerGram] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api.get('/jewelry/gold-rates').then(setRates).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, []);

  async function setRate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/jewelry/gold-rates', { karat: Number(karat), ratePerGram: Number(ratePerGram) });
      toast(t('jewelry.rateUpdated'), 'success');
      setRatePerGram('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={setRate} className="card p-5">
        <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-accent">payments</span>
          {t('jewelry.setTodaysRate')}
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><label className="field-label">{t('jewelry.karat')}</label><input type="number" className="field-input num" value={karat} onChange={(e) => setKarat(e.target.value)} /></div>
          <div><label className="field-label">{t('jewelry.ratePerGram')}</label><input type="number" required className="field-input num" value={ratePerGram} onChange={(e) => setRatePerGram(e.target.value)} /></div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? t('jewelry.saving') : t('jewelry.setRate')}</button>
      </form>

      <div className="card p-5">
        <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-accent">trending_up</span>
          {t('jewelry.currentRates')}
        </p>
        {rates.length === 0 && <p className="text-sm text-ink-muted">{t('jewelry.noRatesYet')}</p>}
        <div className="divide-y divide-rule">
          {rates.map((r) => (
            <div key={r._id} className="flex justify-between items-center text-sm py-2.5">
              <span className="chip-accent">{r.karat}K</span>
              <span className="num font-semibold text-ink">{formatMoney(r.ratePerGram, company?.currency)}/g</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ItemsTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ variantId: '', karat: 22, makingChargeType: 'percentage', makingChargeValue: '', stoneCharge: 0 });
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => { api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'weight'))).catch(() => {}); }, []);

  async function configure(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p.variants.some((v) => v._id === form.variantId));
      await api.post('/jewelry/items/config', {
        productId: product?._id, variantId: form.variantId, karat: Number(form.karat),
        makingChargeType: form.makingChargeType, makingChargeValue: Number(form.makingChargeValue) || 0, stoneCharge: Number(form.stoneCharge) || 0,
      });
      toast(t('jewelry.itemPricingConfigured'), 'success');
      setQuote(null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function getQuote() {
    if (!form.variantId) return;
    setQuoting(true);
    try {
      const q = await api.get(`/jewelry/items/${form.variantId}/quote`);
      setQuote(q);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setQuoting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={configure} className="card p-5">
        <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-accent">sell</span>
          {t('jewelry.configureItemPricing')}
        </p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('jewelry.productWeightTracking')}</label>
            <select required className="field-input" value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })}>
              <option value="">{t('jewelry.selectPlaceholder')}</option>
              {products.map((p) => p.variants.map((v) => <option key={v._id} value={v._id}>{p.name} ({v.weight}g)</option>))}
            </select>
            {products.length === 0 && <p className="text-xs text-warning mt-1">{t('jewelry.createWeightProductHint')}</p>}
          </div>
          <div><label className="field-label">{t('jewelry.karat')}</label><input type="number" required className="field-input num" value={form.karat} onChange={(e) => setForm({ ...form, karat: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('jewelry.makingCharge')}</label>
              <select className="field-input" value={form.makingChargeType} onChange={(e) => setForm({ ...form, makingChargeType: e.target.value })}>
                <option value="percentage">{t('jewelry.percentOfGoldValue')}</option>
                <option value="fixed">{t('jewelry.fixedAmount')}</option>
              </select>
            </div>
            <div><label className="field-label">{t('jewelry.value')}</label><input type="number" className="field-input num" value={form.makingChargeValue} onChange={(e) => setForm({ ...form, makingChargeValue: e.target.value })} /></div>
          </div>
          <div><label className="field-label">{t('jewelry.stoneCharge')}</label><input type="number" className="field-input num" value={form.stoneCharge} onChange={(e) => setForm({ ...form, stoneCharge: e.target.value })} /></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? t('jewelry.saving') : t('jewelry.saveConfiguration')}</button>
          <button type="button" disabled={!form.variantId || quoting} className="btn-secondary" onClick={getQuote}>{t('jewelry.getQuote')}</button>
        </div>
      </form>

      <div className="card p-5">
        <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-accent">receipt_long</span>
          {t('jewelry.liveQuote')}
        </p>
        {!quote && <p className="text-sm text-ink-muted">{t('jewelry.configureThenQuoteHint')}</p>}
        {quote && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">{t('jewelry.weight')}</span><span className="num">{quote.weightGrams}g @ {quote.karat}k</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">{t('jewelry.goldValue')}</span><span className="num">{formatMoney(quote.goldValue, company?.currency)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">{t('jewelry.makingCharge')}</span><span className="num">{formatMoney(quote.makingCharge, company?.currency)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">{t('jewelry.stoneCharge')}</span><span className="num">{formatMoney(quote.stoneCharge, company?.currency)}</span></div>
            <div className="tear-line my-3" />
            <div className="flex justify-between text-base font-semibold"><span>{t('jewelry.total')}</span><span className="num text-accent-strong">{formatMoney(quote.totalPrice, company?.currency)}</span></div>
            <p className="text-xs text-ink-muted mt-2">{t('jewelry.quoteUsageHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BuybacksTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [buybacks, setBuybacks] = useState([]);
  const [form, setForm] = useState({ karat: 22, weightGrams: '', deductionPercent: 5 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  function load(customerId) {
    if (!customerId) return;
    api.get(`/jewelry/customers/${customerId}/buybacks`).then(setBuybacks).catch(() => {});
  }
  useEffect(() => load(selectedCustomer), [selectedCustomer]);

  async function intake(e) {
    e.preventDefault();
    if (!selectedCustomer) return toast(t('jewelry.selectCustomerFirst'), 'error');
    setSaving(true);
    try {
      const buyback = await api.post('/jewelry/buybacks', { ...form, customerId: selectedCustomer, karat: Number(form.karat), weightGrams: Number(form.weightGrams), deductionPercent: Number(form.deductionPercent) });
      toast(t('jewelry.creditQuoted', { amount: formatMoney(buyback.creditAmount, company?.currency) }), 'success');
      load(selectedCustomer);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5">
        <label className="field-label">{t('jewelry.customer')}</label>
        <select className="field-input mb-5" value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
          <option value="">{t('jewelry.selectPlaceholder')}</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>

        <form onSubmit={intake}>
          <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-accent">sync_alt</span>
            {t('jewelry.intakeOldGold')}
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div><label className="field-label">{t('jewelry.karat')}</label><input type="number" className="field-input num" value={form.karat} onChange={(e) => setForm({ ...form, karat: e.target.value })} /></div>
            <div><label className="field-label">{t('jewelry.weightGrams')}</label><input type="number" required className="field-input num" value={form.weightGrams} onChange={(e) => setForm({ ...form, weightGrams: e.target.value })} /></div>
            <div><label className="field-label">{t('jewelry.deductionPercent')}</label><input type="number" className="field-input num" value={form.deductionPercent} onChange={(e) => setForm({ ...form, deductionPercent: e.target.value })} /></div>
          </div>
          <button type="submit" disabled={saving || !selectedCustomer} className="btn-primary w-full">{saving ? t('jewelry.quoting') : t('jewelry.quoteCredit')}</button>
        </form>
      </div>

      <div className="card p-5">
        <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-accent">history</span>
          {t('jewelry.customerBuybackHistory')}
        </p>
        {!selectedCustomer && <p className="text-sm text-ink-muted">{t('jewelry.selectCustomerHint')}</p>}
        {selectedCustomer && buybacks.length === 0 && <p className="text-sm text-ink-muted">{t('jewelry.noneYet')}</p>}
        <div className="divide-y divide-rule">
          {buybacks.map((b) => (
            <div key={b._id} className="flex justify-between items-center text-sm py-2.5">
              <span className="text-ink-muted">{b.weightGrams}g @ {b.karat}k</span>
              <span className="num flex items-center gap-2">{formatMoney(b.creditAmount, company?.currency)} <span className={b.status === 'applied' ? 'chip-accent' : 'chip-neutral'}>{b.status}</span></span>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-muted mt-3">{t('jewelry.applyCreditHint')}</p>
      </div>
    </div>
  );
}
