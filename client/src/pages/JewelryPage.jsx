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
    ['valuation', t('jewelry.karatValuation'), 'inventory_2'],
    ['savings', t('jewelry.goldSavings'), 'savings'],
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
      {tab === 'valuation' && <ValuationTab />}
      {tab === 'savings' && <GoldSavingsTab />}
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
  const [form, setForm] = useState({
    variantId: '', karat: 22, makingChargeType: 'percentage', makingChargeValue: '', stoneCharge: 0,
    hallmarkNumber: '', hallmarkingAuthority: '', stoneCertNumber: '', stoneCertAuthority: '', stoneCertDetails: '',
  });
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
        hallmarkNumber: form.hallmarkNumber || null, hallmarkingAuthority: form.hallmarkingAuthority || null,
        hallmarkedAt: form.hallmarkNumber ? new Date().toISOString() : null,
        stoneCertNumber: form.stoneCertNumber || null, stoneCertAuthority: form.stoneCertAuthority || null,
        stoneCertDetails: form.stoneCertDetails || null,
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

          <div className="tear-line my-1" />
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{t('jewelry.hallmarkingSection')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">{t('jewelry.hallmarkNumber')}</label><input className="field-input" value={form.hallmarkNumber} onChange={(e) => setForm({ ...form, hallmarkNumber: e.target.value })} placeholder={t('jewelry.hallmarkNumberPlaceholder')} /></div>
            <div><label className="field-label">{t('jewelry.hallmarkingAuthority')}</label><input className="field-input" value={form.hallmarkingAuthority} onChange={(e) => setForm({ ...form, hallmarkingAuthority: e.target.value })} placeholder={t('jewelry.hallmarkingAuthorityPlaceholder')} /></div>
          </div>

          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mt-3">{t('jewelry.stoneCertSection')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">{t('jewelry.stoneCertNumber')}</label><input className="field-input" value={form.stoneCertNumber} onChange={(e) => setForm({ ...form, stoneCertNumber: e.target.value })} /></div>
            <div><label className="field-label">{t('jewelry.stoneCertAuthority')}</label><input className="field-input" value={form.stoneCertAuthority} onChange={(e) => setForm({ ...form, stoneCertAuthority: e.target.value })} placeholder={t('jewelry.stoneCertAuthorityPlaceholder')} /></div>
          </div>
          <div><label className="field-label">{t('jewelry.stoneCertDetails')}</label><input className="field-input" value={form.stoneCertDetails} onChange={(e) => setForm({ ...form, stoneCertDetails: e.target.value })} placeholder={t('jewelry.stoneCertDetailsPlaceholder')} /></div>
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

function ValuationTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/jewelry/reports/karat-valuation').then(setReport).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!report || report.karats.length === 0) return <EmptyState title={t('jewelry.noValuationYet')} description={t('jewelry.noValuationYetDescription')} />;

  return (
    <div>
      <div className="card p-5 mb-5 flex justify-between items-center">
        <div>
          <p className="eyebrow mb-1">{t('jewelry.grandTotalValue')}</p>
          <p className="font-display text-3xl font-bold text-accent num">{formatMoney(report.grandTotalValue, company?.currency)}</p>
        </div>
        <p className="text-xs text-ink-muted">{t('jewelry.asOf')} {new Date(report.asOf).toLocaleString()}</p>
      </div>

      <div className="space-y-5">
        {report.karats.map((k) => (
          <div key={k.karat} className="card overflow-hidden">
            <div className="flex justify-between items-center px-5 py-3 border-b border-rule bg-surface-sunken">
              <p className="font-display font-semibold text-accent">{k.karat}{t('jewelry.karatSuffix')}</p>
              <div className="flex gap-5 text-xs text-ink-muted">
                <span>{t('jewelry.items')}: <span className="num text-ink font-semibold">{k.itemCount}</span></span>
                <span>{t('jewelry.totalWeight')}: <span className="num text-ink font-semibold">{k.totalWeightGrams.toFixed(2)}g</span></span>
                <span>{t('jewelry.totalValue')}: <span className="num text-accent-strong font-semibold">{formatMoney(k.totalValue, company?.currency)}</span></span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">{t('jewelry.product')}</th>
                  <th className="px-5 py-2 font-semibold text-right">{t('jewelry.onHandUnits')}</th>
                  <th className="px-5 py-2 font-semibold text-right">{t('jewelry.weight')}</th>
                  <th className="px-5 py-2 font-semibold text-right">{t('jewelry.ratePerGram')}</th>
                  <th className="px-5 py-2 font-semibold text-right">{t('jewelry.totalValue')}</th>
                  <th className="px-5 py-2 font-semibold">{t('jewelry.hallmarkNumber')}</th>
                </tr>
              </thead>
              <tbody>
                {k.items.map((item) => (
                  <tr key={item.variantId} className="border-t border-rule">
                    <td className="px-5 py-2.5">{item.productName}</td>
                    <td className="px-5 py-2.5 num text-right">{item.onHandUnits}</td>
                    <td className="px-5 py-2.5 num text-right">{item.weightGrams.toFixed(2)}g</td>
                    <td className="px-5 py-2.5 num text-right">{formatMoney(item.ratePerGram, company?.currency)}</td>
                    <td className="px-5 py-2.5 num text-right font-semibold">{formatMoney(item.value, company?.currency)}</td>
                    <td className="px-5 py-2.5 text-ink-muted">{item.hallmarkNumber || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoldSavingsTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [schemes, setSchemes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerId: '', branchId: '', targetKarat: 22, monthlyAmount: '', totalMonths: 11, liabilityAccountId: '' });
  const [saving, setSaving] = useState(false);
  const [installmentAmount, setInstallmentAmount] = useState({});
  const [installmentAccount, setInstallmentAccount] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [redeemFor, setRedeemFor] = useState(null);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [redeemForm, setRedeemForm] = useState({ variantId: '', quantity: 1, unitPrice: '', warehouseId: '' });

  function load() {
    api.get('/jewelry/gold-savings').then(setSchemes).catch((err) => toast(err.message, 'error'));
  }
  useEffect(() => {
    load();
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);
  useEffect(() => {
    if (redeemFor) api.get(`/org/warehouses?branchId=${schemes.find((s) => s._id === redeemFor)?.branchId}`).then(setWarehouses).catch(() => {});
  }, [redeemFor]);

  async function enroll(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/jewelry/gold-savings', {
        ...form, targetKarat: Number(form.targetKarat), monthlyAmount: Number(form.monthlyAmount), totalMonths: Number(form.totalMonths),
      });
      toast(t('jewelry.schemeEnrolled'), 'success');
      setShowForm(false);
      setForm({ customerId: '', branchId: '', targetKarat: 22, monthlyAmount: '', totalMonths: 11, liabilityAccountId: '' });
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function payInstallment(schemeId) {
    const amount = Number(installmentAmount[schemeId]);
    const receivedInAccountId = installmentAccount[schemeId];
    if (!amount || !receivedInAccountId) return toast(t('jewelry.enterAmountAndAccount'), 'error');
    setBusyId(schemeId);
    try {
      await api.post(`/jewelry/gold-savings/${schemeId}/installments`, { amount, receivedInAccountId });
      toast(t('jewelry.installmentRecorded'), 'success');
      setInstallmentAmount({ ...installmentAmount, [schemeId]: '' });
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function cancelScheme(schemeId) {
    setBusyId(schemeId);
    try {
      await api.post(`/jewelry/gold-savings/${schemeId}/cancel`);
      toast(t('jewelry.schemeCancelled'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function redeem(schemeId) {
    if (!redeemForm.variantId || !redeemForm.unitPrice || !redeemForm.warehouseId) return toast(t('jewelry.fillRedeemForm'), 'error');
    const product = products.find((p) => p.variants.some((v) => v._id === redeemForm.variantId));
    setBusyId(schemeId);
    try {
      const result = await api.post(`/jewelry/gold-savings/${schemeId}/redeem`, {
        warehouseId: redeemForm.warehouseId,
        items: [{ productId: product?._id, variantId: redeemForm.variantId, quantity: Number(redeemForm.quantity), unitPrice: Number(redeemForm.unitPrice) }],
      });
      toast(t('jewelry.redeemedFor', { weight: result.redeemedWeightGrams }), 'success');
      setRedeemFor(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const statusChip = { active: 'chip-info', matured: 'chip-accent', redeemed: 'chip-neutral', cancelled: 'chip-danger' };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-ink-muted max-w-md">{t('jewelry.goldSavingsDescription')}</p>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{t('jewelry.newScheme')}</button>
      </div>

      {showForm && (
        <form onSubmit={enroll} className="card p-5 mb-5">
          <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-accent">savings</span>
            {t('jewelry.enrollCustomer')}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="field-label">{t('jewelry.customer')}</label>
              <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">{t('jewelry.selectPlaceholder')}</option>
                {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">{t('jewelry.branch')}</label>
              <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                <option value="">{t('jewelry.selectPlaceholder')}</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className="field-label">{t('jewelry.targetKarat')}</label><input type="number" required className="field-input num" value={form.targetKarat} onChange={(e) => setForm({ ...form, targetKarat: e.target.value })} /></div>
            <div><label className="field-label">{t('jewelry.monthlyAmount')}</label><input type="number" required className="field-input num" value={form.monthlyAmount} onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })} /></div>
            <div><label className="field-label">{t('jewelry.totalMonths')}</label><input type="number" required className="field-input num" value={form.totalMonths} onChange={(e) => setForm({ ...form, totalMonths: e.target.value })} /></div>
          </div>
          <div className="mb-4">
            <label className="field-label">{t('jewelry.liabilityAccount')}</label>
            <select required className="field-input" value={form.liabilityAccountId} onChange={(e) => setForm({ ...form, liabilityAccountId: e.target.value })}>
              <option value="">{t('jewelry.selectPlaceholder')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
            <p className="text-xs text-ink-muted mt-1">{t('jewelry.liabilityAccountHint')}</p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? t('jewelry.saving') : t('jewelry.enrollScheme')}</button>
        </form>
      )}

      {schemes.length === 0 && <EmptyState title={t('jewelry.noSchemesYet')} description={t('jewelry.noSchemesYetDescription')} />}
      <div className="space-y-3">
        {schemes.map((s) => (
          <div key={s._id} className="card p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-ink">{s.customerId?.name}</p>
                <p className="text-xs text-ink-muted">{t('jewelry.targetKarat')}: {s.targetKarat}{t('jewelry.karatSuffix')} · {s.installments.length}/{s.totalMonths} {t('jewelry.installmentsLabel')}</p>
              </div>
              <span className={statusChip[s.status] || 'chip-neutral'}>{s.status}</span>
            </div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-ink-muted">{t('jewelry.totalPaid')}</span>
              <span className="num font-semibold text-accent-strong">{formatMoney(s.totalPaid, company?.currency)} / {formatMoney(s.monthlyAmount * s.totalMonths, company?.currency)}</span>
            </div>
            {['active', 'matured'].includes(s.status) && (
              <div className="flex gap-2 items-end border-t border-rule pt-3">
                <div className="flex-1">
                  <label className="field-label">{t('jewelry.amount')}</label>
                  <input type="number" className="field-input num" value={installmentAmount[s._id] || ''} onChange={(e) => setInstallmentAmount({ ...installmentAmount, [s._id]: e.target.value })} />
                </div>
                <div className="flex-1">
                  <label className="field-label">{t('jewelry.receivedInto')}</label>
                  <select className="field-input" value={installmentAccount[s._id] || ''} onChange={(e) => setInstallmentAccount({ ...installmentAccount, [s._id]: e.target.value })}>
                    <option value="">{t('jewelry.selectPlaceholder')}</option>
                    {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                  </select>
                </div>
                <button disabled={busyId === s._id} className="btn-secondary" onClick={() => payInstallment(s._id)}>{t('jewelry.recordInstallment')}</button>
                {s.status === 'matured' && (
                  <button disabled={busyId === s._id} className="btn-primary" onClick={() => { setRedeemFor(redeemFor === s._id ? null : s._id); setRedeemForm({ variantId: '', quantity: 1, unitPrice: '', warehouseId: '' }); }}>
                    {t('jewelry.redeemScheme')}
                  </button>
                )}
                <button disabled={busyId === s._id} className="btn-ghost text-xs text-danger" onClick={() => cancelScheme(s._id)}>{t('jewelry.cancelScheme')}</button>
              </div>
            )}
            {s.status === 'redeemed' && (
              <p className="text-xs text-ink-muted border-t border-rule pt-3">{t('jewelry.redeemedFor', { weight: s.redeemedWeightGrams })}</p>
            )}

            {redeemFor === s._id && (
              <div className="border-t border-rule pt-3 mt-3">
                <p className="text-xs text-ink-muted mb-2">{t('jewelry.redeemHint')}</p>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="field-label">{t('jewelry.itemToRedeem')}</label>
                    <select className="field-input" value={redeemForm.variantId} onChange={(e) => setRedeemForm({ ...redeemForm, variantId: e.target.value })}>
                      <option value="">{t('jewelry.selectPlaceholder')}</option>
                      {products.map((p) => p.variants.map((v) => <option key={v._id} value={v._id}>{p.name} ({v.weight ? `${v.weight}g` : v.sku})</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">{t('jewelry.warehouse')}</label>
                    <select className="field-input" value={redeemForm.warehouseId} onChange={(e) => setRedeemForm({ ...redeemForm, warehouseId: e.target.value })}>
                      <option value="">{t('jewelry.selectPlaceholder')}</option>
                      {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="field-label">{t('jewelry.quantity')}</label><input type="number" className="field-input num" value={redeemForm.quantity} onChange={(e) => setRedeemForm({ ...redeemForm, quantity: e.target.value })} /></div>
                  <div><label className="field-label">{t('jewelry.unitPrice')}</label><input type="number" className="field-input num" value={redeemForm.unitPrice} onChange={(e) => setRedeemForm({ ...redeemForm, unitPrice: e.target.value })} /></div>
                </div>
                <button disabled={busyId === s._id} className="btn-primary w-full" onClick={() => redeem(s._id)}>
                  {busyId === s._id ? t('jewelry.saving') : t('jewelry.confirmRedeem')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
