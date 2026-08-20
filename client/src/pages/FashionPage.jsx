import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function FashionPage() {
  const [tab, setTab] = useState('schedules');
  return (
    <div>
      <p className="page-title mb-4">Fashion / Boutique</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['schedules', 'Markdown schedules'], ['price-check', 'Check current price']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'schedules' && <SchedulesTab />}
      {tab === 'price-check' && <PriceCheckTab />}
    </div>
  );
}

function SchedulesTab() {
  const toast = useToast();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/fashion/markdown-schedules').then(setSchedules).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>New schedule</button>
      </div>
      {loading && <Loading />}
      {!loading && schedules.length === 0 && (
        <EmptyState
          title="No markdown schedules yet"
          description="Set up a time-decay discount schedule so a product's price drops automatically the longer it sits unsold."
          action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add a schedule</button>}
        />
      )}
      {!loading && schedules.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {schedules.map((s) => (
            <div key={s._id} className="card p-3">
              <p className="text-sm font-medium">{s.productId?.name || 'Unknown product'}</p>
              <p className="text-xs text-ink-muted mt-1">Variant: {s.variantId}</p>
              <p className="text-xs text-ink-muted mt-1">Launched {formatDate(s.launchDate)}</p>
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="text-left text-ink-muted uppercase tracking-wide">
                    <th className="py-1 font-medium">Day</th>
                    <th className="py-1 font-medium">Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {s.stages.map((st, i) => (
                    <tr key={i} className="border-t border-rule">
                      <td className="py-1 num">{st.daysSinceLaunch}</td>
                      <td className="py-1 num">{st.discountPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {showForm && <ScheduleForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ScheduleForm({ onClose, onSaved }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [launchDate, setLaunchDate] = useState('');
  const [stages, setStages] = useState([{ daysSinceLaunch: '0', discountPercent: '0' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  const product = products.find((p) => p._id === productId);
  const variants = product?.variants || [];

  function updateStage(idx, field, value) {
    setStages((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }
  function addStage() {
    setStages((rows) => [...rows, { daysSinceLaunch: '', discountPercent: '' }]);
  }
  function removeStage(idx) {
    setStages((rows) => rows.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!variantId) throw new Error('Select a variant.');
      if (stages.length === 0) throw new Error('At least one stage is required.');
      const payload = {
        productId,
        variantId,
        stages: stages.map((s) => ({ daysSinceLaunch: Number(s.daysSinceLaunch), discountPercent: Number(s.discountPercent) })),
      };
      if (launchDate) payload.launchDate = launchDate;
      await api.post('/fashion/markdown-schedules', payload);
      toast('Markdown schedule saved.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">New markdown schedule</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Product</label>
            <select required className="field-input" value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId(''); }}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Variant</label>
            <select required className="field-input" value={variantId} onChange={(e) => setVariantId(e.target.value)} disabled={!productId}>
              <option value="">Select…</option>
              {variants.map((v) => <option key={v._id} value={v._id}>{v.name || v.sku || v._id}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Launch date (optional, defaults to today)</label>
            <input type="date" className="field-input" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Stages (first stage must start at day 0)</label>
            <div className="space-y-2">
              {stages.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Day"
                    className="field-input num"
                    value={s.daysSinceLaunch}
                    onChange={(e) => updateStage(idx, 'daysSinceLaunch', e.target.value)}
                  />
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    placeholder="Discount %"
                    className="field-input num"
                    value={s.discountPercent}
                    onChange={(e) => updateStage(idx, 'discountPercent', e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost !text-danger !px-2 text-xs"
                    onClick={() => removeStage(idx)}
                    disabled={stages.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary mt-2 text-xs" onClick={addStage}>+ Add stage</button>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function PriceCheckTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [manualVariantId, setManualVariantId] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  const product = products.find((p) => p._id === productId);
  const variants = product?.variants || [];

  async function handleCheck(e) {
    e.preventDefault();
    const targetVariantId = manualVariantId || variantId;
    if (!targetVariantId) {
      toast('Select or enter a variant id.', 'error');
      return;
    }
    setChecking(true);
    setResult(null);
    try {
      const data = await api.get(`/fashion/items/${targetVariantId}/current-price`);
      setResult(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="card p-5 max-w-md">
      <p className="font-display text-lg mb-4">Check current price</p>
      <form onSubmit={handleCheck} className="space-y-3">
        <div>
          <label className="field-label">Product</label>
          <select className="field-input" value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId(''); setManualVariantId(''); }}>
            <option value="">Select…</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Variant</label>
          <select className="field-input" value={variantId} onChange={(e) => { setVariantId(e.target.value); setManualVariantId(''); }} disabled={!productId}>
            <option value="">Select…</option>
            {variants.map((v) => <option key={v._id} value={v._id}>{v.name || v.sku || v._id}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Or enter a variant id directly</label>
          <input className="field-input" value={manualVariantId} onChange={(e) => setManualVariantId(e.target.value)} placeholder="Variant ObjectId" />
        </div>
        <button type="submit" disabled={checking} className="btn-primary w-full">{checking ? 'Checking…' : 'Check price'}</button>
      </form>
      {result && (
        <div className="mt-4 pt-4 border-t border-rule text-sm space-y-1">
          <p>Base price: <span className="num">{formatMoney(result.basePrice, company?.currency)}</span></p>
          <p>Discount: <span className="num">{result.discountPercent}%</span></p>
          <p className="font-medium">Current price: <span className="num text-accent-strong">{formatMoney(result.currentPrice, company?.currency)}</span></p>
          <p className="text-xs text-ink-muted">
            {result.stageApplied === null
              ? 'No markdown schedule configured — this is the plain selling price.'
              : `Stage applied at day ${result.stageApplied} (${result.daysSinceLaunch} days since launch)`}
          </p>
        </div>
      )}
    </div>
  );
}
