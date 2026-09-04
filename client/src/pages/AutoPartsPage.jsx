import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function AutoPartsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('lookup');
  const tabs = [['lookup', t('autoParts.whatFitsMyCar')], ['fitments', t('autoParts.addFitment')]];
  return (
    <div>
      <div className="mb-5">
        <p className="eyebrow mb-1">{t('autoParts.autoParts')}</p>
        <p className="page-title">{t('autoParts.fitmentDesk')}</p>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>{label}</button>
        ))}
      </div>
      {tab === 'lookup' && <LookupTab />}
      {tab === 'fitments' && <FitmentTab />}
    </div>
  );
}

function LookupTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function search(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams({ year });
      if (make) params.set('make', make);
      if (model) params.set('model', model);
      const rows = await api.get(`/auto-parts/lookup?${params.toString()}`);
      setResults(rows);
    } catch (err) { toast(err.message, 'error'); } finally { setLoading(false); }
  }

  return (
    <div>
      <form onSubmit={search} className="card p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div><label className="field-label">{t('autoParts.make')}</label><input placeholder={t('autoParts.make')} className="field-input" value={make} onChange={(e) => setMake(e.target.value)} /></div>
          <div><label className="field-label">{t('autoParts.model')}</label><input placeholder={t('autoParts.model')} className="field-input" value={model} onChange={(e) => setModel(e.target.value)} /></div>
          <div><label className="field-label">{t('autoParts.year')}</label><input type="number" placeholder={t('autoParts.year')} required className="field-input num" value={year} onChange={(e) => setYear(e.target.value)} /></div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? t('autoParts.searching') : t('autoParts.findParts')}</button>
      </form>
      {results && results.length === 0 && <EmptyState title={t('autoParts.noMatchingPartsFound')} />}
      {results && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results.map((r) => (
            <div key={r.fitmentId} className="card p-4">
              <p className="text-sm font-semibold text-ink">{r.productName}</p>
              <p className="text-xs text-ink-muted mt-0.5">{t('autoParts.sku')} {r.sku}</p>
              <p className="num text-sm font-semibold text-accent-strong mt-2">{formatMoney(r.sellingPrice)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FitmentTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ productId: '', make: '', model: '', yearFrom: '', yearTo: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/auto-parts/fitments', { ...form, yearFrom: Number(form.yearFrom), yearTo: Number(form.yearTo) });
      toast(t('autoParts.fitmentAdded'), 'success');
      setForm({ productId: '', make: '', model: '', yearFrom: '', yearTo: '' });
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 max-w-sm">
      <p className="font-display text-lg text-ink mb-4">{t('autoParts.registerFitment')}</p>
      <div className="space-y-3">
        <div><label className="field-label">{t('autoParts.product')}</label><select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}><option value="">{t('autoParts.selectEllipsis')}</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="field-label">{t('autoParts.make')}</label><input placeholder={t('autoParts.make')} required className="field-input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
          <div><label className="field-label">{t('autoParts.model')}</label><input placeholder={t('autoParts.model')} required className="field-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="field-label">{t('autoParts.yearFrom')}</label><input type="number" placeholder={t('autoParts.yearFrom')} required className="field-input num" value={form.yearFrom} onChange={(e) => setForm({ ...form, yearFrom: e.target.value })} /></div>
          <div><label className="field-label">{t('autoParts.yearTo')}</label><input type="number" placeholder={t('autoParts.yearTo')} required className="field-input num" value={form.yearTo} onChange={(e) => setForm({ ...form, yearTo: e.target.value })} /></div>
        </div>
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full mt-5">{saving ? t('autoParts.saving') : t('autoParts.addFitment')}</button>
    </form>
  );
}
