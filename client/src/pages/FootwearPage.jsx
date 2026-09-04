import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function FootwearPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [curves, setCurves] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [applying, setApplying] = useState(null);
  const [totalQuantity, setTotalQuantity] = useState('');
  const [productId, setProductId] = useState('');
  const [result, setResult] = useState(null);

  function load() {
    setLoading(true);
    api.get('/footwear/size-curves').then(setCurves).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
    api.get('/products').then(setProducts).catch(() => {});
  }
  useEffect(load, []);

  async function apply(e) {
    e.preventDefault();
    try {
      const r = await api.post(`/footwear/size-curves/${applying._id}/apply`, { productId, totalQuantity: Number(totalQuantity) });
      setResult(r);
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="eyebrow mb-1">{t('footwear.footwearOperations')}</p>
          <p className="page-title">{t('footwear.sizeCurves')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          {t('footwear.newCurve')}
        </button>
      </div>

      {loading && <Loading />}
      {!loading && curves.length === 0 && <EmptyState title={t('footwear.noSizeCurvesYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('footwear.addOne')}</button>} />}
      {!loading && curves.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {curves.map((c) => (
            <div key={c._id} className="card p-4">
              <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-accent text-base">straighten</span>
                {c.name}
              </p>
              <div className="divide-y divide-rule">
                {c.ratios.map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 text-xs">
                    <span className="text-ink-muted">{t('footwear.size', { size: r.sizeLabel })}</span>
                    <span className="chip-neutral num">{r.percent}%</span>
                  </div>
                ))}
              </div>
              <button className="btn-ghost !text-accent !px-0 text-xs mt-3" onClick={() => { setApplying(c); setResult(null); }}>{t('footwear.applyToOrder')}</button>
            </div>
          ))}
        </div>
      )}
      {showForm && <CurveForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {applying && (
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
          <form onSubmit={apply} className="card p-5 w-full max-w-sm">
            <p className="font-display text-lg font-bold text-ink mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-accent">straighten</span>
              {t('footwear.apply', { name: applying.name })}
            </p>
            <div className="space-y-3 mb-3">
              <div>
                <label className="field-label">{t('footwear.product')}</label>
                <select required className="field-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">{t('footwear.selectEllipsis')}</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">{t('footwear.totalQuantityToOrder')}</label>
                <input type="number" required className="field-input num" value={totalQuantity} onChange={(e) => setTotalQuantity(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full mb-3">{t('footwear.computeSplit')}</button>
            {result && (
              <div className="text-sm space-y-1 mb-1">
                {result.map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 text-xs border-b border-rule last:border-b-0">
                    <span className="text-ink-muted">{t('footwear.size', { size: r.sizeLabel })}</span>
                    <span className="num text-ink font-semibold">{r.quantity}</span>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn-secondary w-full mt-3" onClick={() => setApplying(null)}>{t('footwear.close')}</button>
          </form>
        </div>
      )}
    </div>
  );
}

function CurveForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [ratios, setRatios] = useState([{ sizeLabel: '', percent: '' }]);
  const [saving, setSaving] = useState(false);
  function update(i, patch) { setRatios((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/footwear/size-curves', { name, ratios: ratios.map((r) => ({ sizeLabel: r.sizeLabel, percent: Number(r.percent) })) });
      toast(t('footwear.curveSaved'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-accent">straighten</span>
          {t('footwear.newSizeCurve')}
        </p>
        <div className="mb-4">
          <label className="field-label">{t('footwear.name')}</label>
          <input required className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <p className="field-label mb-2">{t('footwear.sizes')}</p>
        <div className="space-y-2 mb-2">
          {ratios.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input placeholder={t('footwear.sizeLabel')} className="field-input" value={r.sizeLabel} onChange={(e) => update(i, { sizeLabel: e.target.value })} />
              <input type="number" placeholder={t('footwear.percent')} className="field-input num" value={r.percent} onChange={(e) => update(i, { percent: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setRatios([...ratios, { sizeLabel: '', percent: '' }])}>{t('footwear.addSize')}</button>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('footwear.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('footwear.savingEllipsis') : t('footwear.save')}</button>
        </div>
      </form>
    </div>
  );
}
