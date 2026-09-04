import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function FashionPage() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checking, setChecking] = useState('');
  const [price, setPrice] = useState(null);

  function load() {
    setLoading(true);
    api.get('/fashion/markdown-schedules').then(setSchedules).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function checkPrice() {
    try {
      const p = await api.get(`/fashion/items/${checking}/current-price`);
      setPrice(p);
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="eyebrow mb-1">{t('fashion.fashionOperations')}</p>
          <p className="page-title">{t('fashion.markdownSchedules')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          {t('fashion.newSchedule')}
        </button>
      </div>

      <div className="card p-5 mb-6 max-w-sm">
        <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-accent">search</span>
          {t('fashion.checkCurrentPrice')}
        </p>
        <label className="field-label">{t('fashion.variantId')}</label>
        <div className="flex gap-2">
          <input className="field-input" value={checking} onChange={(e) => setChecking(e.target.value)} />
          <button className="btn-secondary shrink-0" onClick={checkPrice}>{t('fashion.check')}</button>
        </div>
        {price && (
          <div className="mt-4 text-sm space-y-2">
            <div className="flex justify-between"><span className="text-ink-muted">{t('fashion.basePrice')}</span><span className="num">{formatMoney(price.basePrice, company?.currency)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">{t('fashion.discount')}</span><span className="num">{price.discountPercent}%</span></div>
            <div className="tear-line my-1" />
            <div className="flex justify-between text-base font-semibold"><span>{t('fashion.currentPrice')}</span><span className="num text-accent-strong">{formatMoney(price.currentPrice, company?.currency)}</span></div>
          </div>
        )}
      </div>

      {loading && <Loading />}
      {!loading && schedules.length === 0 && <EmptyState title={t('fashion.noMarkdownSchedulesYet')} />}
      {!loading && schedules.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((s) => (
            <div key={s._id} className="card p-4">
              <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-accent text-base">trending_down</span>
                {s.productId?.name}
              </p>
              <div className="divide-y divide-rule">
                {s.stages.map((st, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 text-xs">
                    <span className="text-ink-muted">{t('fashion.day', { day: st.daysSinceLaunch })}</span>
                    <span className="chip-warning">{t('fashion.percentOff', { percent: st.discountPercent })}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && <ScheduleForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ScheduleForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [launchDate, setLaunchDate] = useState('');
  const [stages, setStages] = useState([{ daysSinceLaunch: 0, discountPercent: 0 }]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  function updateStage(i, patch) { setStages((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s)); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === productId);
      if (!product) throw new Error(t('fashion.selectAProductError'));
      await api.post('/fashion/markdown-schedules', {
        productId, variantId: product.variants[0]?._id, launchDate: launchDate || undefined,
        stages: stages.map((s) => ({ daysSinceLaunch: Number(s.daysSinceLaunch), discountPercent: Number(s.discountPercent) })),
      });
      toast(t('fashion.scheduleSaved'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-accent">trending_down</span>
          {t('fashion.newMarkdownSchedule')}
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="field-label">{t('fashion.product')}</label>
            <select required className="field-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">{t('fashion.selectEllipsis')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('fashion.launchDateBlankIsToday')}</label>
            <input type="date" className="field-input" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
          </div>
        </div>
        <p className="field-label mb-2">{t('fashion.stagesFirstMustStartDayZero')}</p>
        <div className="space-y-2 mb-2">
          {stages.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input type="number" placeholder={t('fashion.daysSinceLaunch')} className="field-input num" value={s.daysSinceLaunch} onChange={(e) => updateStage(i, { daysSinceLaunch: e.target.value })} />
              <input type="number" placeholder={t('fashion.discountPercent')} className="field-input num" value={s.discountPercent} onChange={(e) => updateStage(i, { discountPercent: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setStages([...stages, { daysSinceLaunch: '', discountPercent: '' }])}>{t('fashion.addStage')}</button>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('fashion.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('fashion.savingEllipsis') : t('fashion.save')}</button>
        </div>
      </form>
    </div>
  );
}
