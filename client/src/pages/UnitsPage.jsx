import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function UnitsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/units').then(setUnits).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleRemove(u) {
    if (!window.confirm(t('units.removeConfirm', { name: u.name }))) return;
    try {
      await api.del(`/units/${u._id}`);
      toast(t('units.unitRemoved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <p className="page-title">{t('units.title')}</p>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">{t('units.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('units.newUnit')}
        </button>
      </div>

      {loading && <Loading />}
      {!loading && units.length === 0 && (
        <EmptyState title={t('units.noUnitsYet')} description={t('units.noUnitsDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('units.newUnit')}</button>} />
      )}
      {!loading && units.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">{t('units.unitRegister')}</p>
            <span className="eyebrow">{t('units.unitsCount', { count: units.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">{t('units.name')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('units.code')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('units.convertsTo')}</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">{t('units.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {units.map((u) => (
                  <tr key={u._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5 text-sm font-semibold text-ink">{u.name}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted num">{u.shortCode}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted">
                      {u.baseUnitId ? <span className="num">{t('units.conversionFormula', { unit: u.name, factor: u.conversionFactor, baseUnit: u.baseUnitId.name })}</span> : <span className="chip-neutral">{t('units.baseUnit')}</span>}
                    </td>
                    <td className="py-3 px-5 text-right"><button className="btn-ghost !text-danger text-xs" onClick={() => handleRemove(u)}>{t('units.remove')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <UnitForm units={units} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function UnitForm({ units, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', shortCode: '', baseUnitId: '', conversionFactor: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/units', {
        name: form.name, shortCode: form.shortCode,
        baseUnitId: form.baseUnitId || undefined,
        conversionFactor: form.baseUnitId ? Number(form.conversionFactor) : undefined,
      });
      toast(t('units.unitCreated'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('units.newUnit')}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('units.name')}</label>
              <input required placeholder={t('units.namePlaceholder')} className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('units.code')}</label>
              <input required placeholder={t('units.codePlaceholder')} className="field-input" value={form.shortCode} onChange={(e) => setForm({ ...form, shortCode: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">{t('units.convertsToOptional')}</label>
            <select className="field-input" value={form.baseUnitId} onChange={(e) => setForm({ ...form, baseUnitId: e.target.value })}>
              <option value="">{t('units.thisIsABaseUnit')}</option>
              {units.filter((u) => !u.baseUnitId).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          {form.baseUnitId && (
            <div>
              <label className="field-label">{t('units.conversionQuestion', { unit: form.name || t('units.unitFallback'), baseUnit: units.find((u) => u._id === form.baseUnitId)?.name })}</label>
              <input type="number" step="0.0001" min="0.0001" required className="field-input num" value={form.conversionFactor} onChange={(e) => setForm({ ...form, conversionFactor: e.target.value })} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('units.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('units.creating') : t('units.create')}</button>
        </div>
      </form>
    </div>
  );
}
