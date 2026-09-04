import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function PetrolPumpPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('dispensers');
  return (
    <div>
      <p className="page-title mb-1">{t('petrolPump.title')}</p>
      <p className="text-sm text-ink-muted mb-5">{t('petrolPump.subtitle')}</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['dispensers', t('petrolPump.dispensers')], ['shifts', t('petrolPump.shifts')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'dispensers' && <DispensersTab />}
      {tab === 'shifts' && <ShiftsTab />}
    </div>
  );
}

function DispensersTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [dispensers, setDispensers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [opening, setOpening] = useState(null);

  function load() {
    setLoading(true);
    api.get('/petrol-pump/dispensers').then(setDispensers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="eyebrow">{t('petrolPump.dispenserCount', { count: dispensers.length })}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-[18px] leading-none">add</span>
          {t('petrolPump.addDispenser')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && dispensers.length === 0 && <EmptyState title={t('petrolPump.noDispensersYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('petrolPump.addADispenser')}</button>} />}
      {!loading && dispensers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {dispensers.map((d) => (
            <div key={d._id} className="card p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{d.name}</p>
                <span className="chip-neutral shrink-0">{t('petrolPump.meter')}</span>
              </div>
              <p className="text-2xl font-display font-bold num text-ink">{d.currentMeterReading}</p>
              <button className="btn-ghost !px-0 !py-0 h-auto justify-start text-xs !text-accent w-fit mt-1" onClick={() => setOpening(d)}>{t('petrolPump.openShiftArrow')}</button>
            </div>
          ))}
        </div>
      )}
      {showForm && <DispenserForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {opening && <OpenShiftForm dispenser={opening} onClose={() => setOpening(null)} />}
    </div>
  );
}

function DispenserForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ branchId: '', name: '', productId: '', variantId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);

  const selectedProduct = products.find((p) => p._id === form.productId);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!form.variantId) throw new Error(t('petrolPump.selectProductWithVariant'));
      await api.post('/petrol-pump/dispensers', form);
      toast(t('petrolPump.dispenserCreated'), 'success');
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
        <p className="font-display text-lg font-semibold mb-4">{t('petrolPump.addDispenser')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('petrolPump.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('petrolPump.selectEllipsis')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">{t('petrolPump.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('petrolPump.dispenserNamePlaceholder')} /></div>
          <div>
            <label className="field-label">{t('petrolPump.fuelProduct')}</label>
            <select required className="field-input" value={form.productId} onChange={(e) => {
              const product = products.find((p) => p._id === e.target.value);
              setForm({ ...form, productId: e.target.value, variantId: product?.variants?.[0]?._id || '' });
            }}>
              <option value="">{t('petrolPump.selectEllipsis')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            {form.productId && !selectedProduct?.variants?.length && <p className="text-xs text-warning mt-1">{t('petrolPump.noVariantsWarning')}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('petrolPump.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('petrolPump.saving') : t('petrolPump.save')}</button>
        </div>
      </form>
    </div>
  );
}

function OpenShiftForm({ dispenser, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [pricePerLitre, setPricePerLitre] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/petrol-pump/dispensers/${dispenser._id}/shifts/open`, { pricePerLitre: Number(pricePerLitre) });
      toast(t('petrolPump.shiftOpened'), 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-semibold mb-1">{t('petrolPump.openShiftPrefix')} {dispenser.name}</p>
        <p className="text-sm text-ink-muted mb-4 num">{t('petrolPump.openingReading')}: {dispenser.currentMeterReading}</p>
        <div><label className="field-label">{t('petrolPump.pricePerLitre')}</label><input type="number" step="0.01" required autoFocus className="field-input num" value={pricePerLitre} onChange={(e) => setPricePerLitre(e.target.value)} /></div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('petrolPump.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('petrolPump.opening') : t('petrolPump.openShift')}</button>
        </div>
      </form>
    </div>
  );
}

function ShiftsTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(null);

  function load() {
    setLoading(true);
    api.get('/petrol-pump/shifts').then(setShifts).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (loading) return <Loading />;
  if (shifts.length === 0) return <EmptyState title={t('petrolPump.noShiftsYet')} />;

  return (
    <div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                <th className="px-3 py-2.5 font-semibold">{t('petrolPump.dispenser')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('petrolPump.opening')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('petrolPump.closing')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('petrolPump.litresSold')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('petrolPump.priceL')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('petrolPump.status')}</th>
                <th className="px-3 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/50">
                  <td className="px-3 py-2.5 font-medium text-ink">{s.dispenserId?.name || '-'}</td>
                  <td className="px-3 py-2.5 num">{s.openingReading}</td>
                  <td className="px-3 py-2.5 num">{s.closingReading ?? '-'}</td>
                  <td className="px-3 py-2.5 num">{s.litresSold ?? '-'}</td>
                  <td className="px-3 py-2.5 num">{formatMoney(s.pricePerLitre, company?.currency)}</td>
                  <td className="px-3 py-2.5"><span className={s.status === 'open' ? 'chip-warning' : 'chip-accent'}>{s.status}</span></td>
                  <td className="px-3 py-2.5">
                    {s.status === 'open' && <button className="btn-ghost !px-0 !py-0 h-auto !text-accent text-xs" onClick={() => setClosing(s)}>{t('petrolPump.closeShift')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {closing && <CloseShiftForm shift={closing} onClose={() => setClosing(null)} onSaved={() => { setClosing(null); load(); }} />}
    </div>
  );
}

function CloseShiftForm({ shift, onClose, onSaved }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ closingReading: '', warehouseId: '', billingProductId: '', billingVariantId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/warehouses').then(setWarehouses).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);

  const selectedProduct = products.find((p) => p._id === form.billingProductId);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!form.billingVariantId) throw new Error(t('petrolPump.selectBillingProductWithVariant'));
      const result = await api.post(`/petrol-pump/shifts/${shift._id}/close`, { ...form, closingReading: Number(form.closingReading) });
      toast(
        t('petrolPump.shiftClosedSummary', { litres: result.litresSold, amount: formatMoney(result.totalAmount, company?.currency) }),
        'success'
      );
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
        <p className="font-display text-lg font-semibold mb-1">{t('petrolPump.closeShiftPrefix')} {shift.dispenserId?.name || ''}</p>
        <p className="text-sm text-ink-muted mb-4 num">{t('petrolPump.openingReading')}: {shift.openingReading}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('petrolPump.closingReading')}</label><input type="number" step="0.001" required autoFocus className="field-input num" value={form.closingReading} onChange={(e) => setForm({ ...form, closingReading: e.target.value })} /></div>
          <div>
            <label className="field-label">{t('petrolPump.warehouse')}</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">{t('petrolPump.selectEllipsis')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('petrolPump.billingProductFuelGrade')}</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => {
              const product = products.find((p) => p._id === e.target.value);
              setForm({ ...form, billingProductId: e.target.value, billingVariantId: product?.variants?.[0]?._id || '' });
            }}>
              <option value="">{t('petrolPump.selectEllipsis')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            {form.billingProductId && !selectedProduct?.variants?.length && <p className="text-xs text-warning mt-1">{t('petrolPump.noVariantsWarning')}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('petrolPump.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('petrolPump.closing') : t('petrolPump.closeShift')}</button>
        </div>
      </form>
    </div>
  );
}
