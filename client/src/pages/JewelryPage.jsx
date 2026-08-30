import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const TABS = [
  ['rates', 'Gold rates', 'payments'],
  ['items', 'Item pricing', 'sell'],
  ['buybacks', 'Buy-backs', 'sync_alt'],
];

export function JewelryPage() {
  const [tab, setTab] = useState('rates');
  return (
    <div>
      <div className="mb-5">
        <p className="eyebrow mb-1">Jewelry operations</p>
        <p className="page-title">Jewelry</p>
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
      toast('Rate updated.', 'success');
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
          Set today's rate
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><label className="field-label">Karat</label><input type="number" className="field-input num" value={karat} onChange={(e) => setKarat(e.target.value)} /></div>
          <div><label className="field-label">Rate per gram</label><input type="number" required className="field-input num" value={ratePerGram} onChange={(e) => setRatePerGram(e.target.value)} /></div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Set rate'}</button>
      </form>

      <div className="card p-5">
        <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-accent">trending_up</span>
          Current rates
        </p>
        {rates.length === 0 && <p className="text-sm text-ink-muted">No rates set yet.</p>}
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
      toast('Item pricing configured.', 'success');
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
          Configure item pricing
        </p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Product (trackingMode "weight")</label>
            <select required className="field-input" value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })}>
              <option value="">Select…</option>
              {products.map((p) => p.variants.map((v) => <option key={v._id} value={v._id}>{p.name} ({v.weight}g)</option>))}
            </select>
            {products.length === 0 && <p className="text-xs text-warning mt-1">Create a weight-tracked product on the Products page first.</p>}
          </div>
          <div><label className="field-label">Karat</label><input type="number" required className="field-input num" value={form.karat} onChange={(e) => setForm({ ...form, karat: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Making charge</label>
              <select className="field-input" value={form.makingChargeType} onChange={(e) => setForm({ ...form, makingChargeType: e.target.value })}>
                <option value="percentage">% of gold value</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div><label className="field-label">Value</label><input type="number" className="field-input num" value={form.makingChargeValue} onChange={(e) => setForm({ ...form, makingChargeValue: e.target.value })} /></div>
          </div>
          <div><label className="field-label">Stone charge</label><input type="number" className="field-input num" value={form.stoneCharge} onChange={(e) => setForm({ ...form, stoneCharge: e.target.value })} /></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save configuration'}</button>
          <button type="button" disabled={!form.variantId || quoting} className="btn-secondary" onClick={getQuote}>Get quote</button>
        </div>
      </form>

      <div className="card p-5">
        <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-accent">receipt_long</span>
          Live quote
        </p>
        {!quote && <p className="text-sm text-ink-muted">Configure an item, then click "Get quote".</p>}
        {quote && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">Weight</span><span className="num">{quote.weightGrams}g @ {quote.karat}k</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Gold value</span><span className="num">{formatMoney(quote.goldValue, company?.currency)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Making charge</span><span className="num">{formatMoney(quote.makingCharge, company?.currency)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Stone charge</span><span className="num">{formatMoney(quote.stoneCharge, company?.currency)}</span></div>
            <div className="tear-line my-3" />
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="num text-accent-strong">{formatMoney(quote.totalPrice, company?.currency)}</span></div>
            <p className="text-xs text-ink-muted mt-2">Use this total as the unit price at checkout, it's computed live, never stored on the product.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BuybacksTab() {
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
    if (!selectedCustomer) return toast('Select a customer first.', 'error');
    setSaving(true);
    try {
      const buyback = await api.post('/jewelry/buybacks', { ...form, customerId: selectedCustomer, karat: Number(form.karat), weightGrams: Number(form.weightGrams), deductionPercent: Number(form.deductionPercent) });
      toast(`Credit quoted: ${formatMoney(buyback.creditAmount, company?.currency)}`, 'success');
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
        <label className="field-label">Customer</label>
        <select className="field-input mb-5" value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
          <option value="">Select…</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>

        <form onSubmit={intake}>
          <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-accent">sync_alt</span>
            Intake old gold
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div><label className="field-label">Karat</label><input type="number" className="field-input num" value={form.karat} onChange={(e) => setForm({ ...form, karat: e.target.value })} /></div>
            <div><label className="field-label">Weight (g)</label><input type="number" required className="field-input num" value={form.weightGrams} onChange={(e) => setForm({ ...form, weightGrams: e.target.value })} /></div>
            <div><label className="field-label">Deduction %</label><input type="number" className="field-input num" value={form.deductionPercent} onChange={(e) => setForm({ ...form, deductionPercent: e.target.value })} /></div>
          </div>
          <button type="submit" disabled={saving || !selectedCustomer} className="btn-primary w-full">{saving ? 'Quoting…' : 'Quote credit'}</button>
        </form>
      </div>

      <div className="card p-5">
        <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-accent">history</span>
          This customer's buy-backs
        </p>
        {!selectedCustomer && <p className="text-sm text-ink-muted">Select a customer to see their buy-back history.</p>}
        {selectedCustomer && buybacks.length === 0 && <p className="text-sm text-ink-muted">None yet.</p>}
        <div className="divide-y divide-rule">
          {buybacks.map((b) => (
            <div key={b._id} className="flex justify-between items-center text-sm py-2.5">
              <span className="text-ink-muted">{b.weightGrams}g @ {b.karat}k</span>
              <span className="num flex items-center gap-2">{formatMoney(b.creditAmount, company?.currency)} <span className={b.status === 'applied' ? 'chip-accent' : 'chip-neutral'}>{b.status}</span></span>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-muted mt-3">Apply a credit as a per-line discount at checkout, same as loyalty redemption, this page only quotes and tracks it.</p>
      </div>
    </div>
  );
}
