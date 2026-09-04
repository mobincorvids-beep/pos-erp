import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function DairyPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('collections');
  const [schedules, setSchedules] = useState([]);

  useEffect(() => { api.get('/dairy/quality-schedules').then(setSchedules).catch(() => {}); }, []);

  return (
    <div>
      <p className="eyebrow mb-1">{t('dairy.eyebrow')}</p>
      <p className="page-title mb-5">{t('dairy.title')}</p>
      <div className="flex gap-2 mb-5">
        {[['collections', t('dairy.tabCollections')], ['schedules', t('dairy.tabQualitySchedules')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'collections' && <CollectionsTab schedules={schedules} />}
      {tab === 'schedules' && <SchedulesTab schedules={schedules} setSchedules={setSchedules} />}
    </div>
  );
}

function SchedulesTab({ schedules, setSchedules }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);

  // Schedules are loaded fresh from the real endpoint on mount (see
  // DairyPage above) — created here, they're appended to that same
  // state so the Collections tab sees them immediately, without waiting
  // for a refetch.
  function handleSaved(schedule) {
    setSchedules((prev) => [schedule, ...prev]);
    setShowForm(false);
    toast(t('dairy.qualityScheduleCreated'), 'success');
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('dairy.newSchedule')}</button>
      </div>
      {schedules.length === 0 && !showForm && (
        <EmptyState title={t('dairy.noQualitySchedulesYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('dairy.addASchedule')}</button>} />
      )}
      {schedules.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {schedules.map((s) => (
            <div key={s._id} className="card p-4">
              <p className="text-sm font-semibold text-ink mb-3">{s.name}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-muted uppercase tracking-wide">
                    <th className="font-medium pr-2 py-1">{t('dairy.minFatPercent')}</th>
                    <th className="font-medium py-1">{t('dairy.pricePerLitre')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.bands.map((b, i) => (
                    <tr key={i} className="border-t border-rule">
                      <td className="pr-2 py-1.5 num">{b.minFatPercent}%</td>
                      <td className="py-1.5 num">{formatMoney(b.pricePerLitre)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {showForm && <ScheduleForm onClose={() => setShowForm(false)} onSaved={handleSaved} />}
    </div>
  );
}

function ScheduleForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [bands, setBands] = useState([{ minFatPercent: '', pricePerLitre: '' }]);
  const [saving, setSaving] = useState(false);

  function updateBand(index, field, value) {
    setBands((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }
  function addBand() {
    setBands((prev) => [...prev, { minFatPercent: '', pricePerLitre: '' }]);
  }
  function removeBand(index) {
    setBands((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payloadBands = bands.map((b) => ({
        minFatPercent: Number(b.minFatPercent),
        pricePerLitre: Number(b.pricePerLitre),
      }));
      const schedule = await api.post('/dairy/quality-schedules', { name, bands: payloadBands });
      onSaved(schedule);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-md">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('dairy.newQualitySchedule')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('dairy.name')}</label>
            <input required autoFocus className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('dairy.namePlaceholder')} />
          </div>
          <div>
            <label className="field-label">{t('dairy.bandsLabel')}</label>
            <div className="space-y-2">
              {bands.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="number" step="0.1" required className="field-input num" placeholder={t('dairy.minFatPercent')} value={b.minFatPercent} onChange={(e) => updateBand(i, 'minFatPercent', e.target.value)} />
                  <input type="number" step="0.01" required className="field-input num" placeholder={t('dairy.pricePerLitre')} value={b.pricePerLitre} onChange={(e) => updateBand(i, 'pricePerLitre', e.target.value)} />
                  <button type="button" className="btn-ghost !px-2 text-xs" disabled={bands.length === 1} onClick={() => removeBand(i)}><X size={13} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-ghost !text-accent !px-0 text-xs mt-2" onClick={addBand}>{t('dairy.addBand')}</button>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('dairy.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('dairy.saving') : t('dairy.save')}</button>
        </div>
      </form>
    </div>
  );
}

function CollectionsTab({ schedules }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/dairy/collections').then(setCollections).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('dairy.recordCollection')}</button>
      </div>
      {loading && <Loading />}
      {!loading && collections.length === 0 && (
        <EmptyState title={t('dairy.noCollectionsRecordedYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('dairy.recordACollection')}</button>} />
      )}
      {!loading && collections.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                <th className="px-3 py-2 font-medium">{t('dairy.supplier')}</th>
                <th className="px-3 py-2 font-medium">{t('dairy.litres')}</th>
                <th className="px-3 py-2 font-medium">{t('dairy.fatPercent')}</th>
                <th className="px-3 py-2 font-medium">{t('dairy.pricePerLitre')}</th>
                <th className="px-3 py-2 font-medium">{t('dairy.totalPayable')}</th>
                <th className="px-3 py-2 font-medium">{t('dairy.status')}</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/50 transition-colors">
                  <td className="px-3 py-2 text-ink">{c.supplierId?.name || '-'}</td>
                  <td className="px-3 py-2 num">{c.litres}</td>
                  <td className="px-3 py-2 num">{c.fatPercent}%</td>
                  <td className="px-3 py-2 num">{c.pricePerLitre != null ? formatMoney(c.pricePerLitre, company?.currency) : '-'}</td>
                  <td className="px-3 py-2 num">{c.totalPayable != null ? formatMoney(c.totalPayable, company?.currency) : '-'}</td>
                  <td className="px-3 py-2"><span className={c.paid ? 'chip-accent' : 'chip-warning'}>{c.paid ? t('dairy.paid') : t('dairy.unpaid')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <CollectionForm schedules={schedules} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CollectionForm({ schedules, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ branchId: '', supplierId: '', litres: '', fatPercent: '', scheduleId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/suppliers').then(setSuppliers).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/dairy/collections', {
        ...form,
        litres: Number(form.litres),
        fatPercent: Number(form.fatPercent),
      });
      toast(t('dairy.collectionRecorded'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('dairy.recordCollection')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('dairy.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('dairy.select')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('dairy.supplier')}</label>
            <select required className="field-input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">{t('dairy.select')}</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">{t('dairy.litres')}</label><input type="number" step="0.01" required className="field-input num" value={form.litres} onChange={(e) => setForm({ ...form, litres: e.target.value })} /></div>
            <div><label className="field-label">{t('dairy.fatPercent')}</label><input type="number" step="0.01" required className="field-input num" value={form.fatPercent} onChange={(e) => setForm({ ...form, fatPercent: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">{t('dairy.qualitySchedule')}</label>
            <select required className="field-input" value={form.scheduleId} onChange={(e) => setForm({ ...form, scheduleId: e.target.value })}>
              <option value="">{t('dairy.select')}</option>
              {schedules.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            {schedules.length === 0 && <p className="text-xs text-warning mt-1">{t('dairy.createScheduleFirst')}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('dairy.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('dairy.saving') : t('dairy.save')}</button>
        </div>
      </form>
    </div>
  );
}
