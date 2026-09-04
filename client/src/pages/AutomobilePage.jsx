import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function AutomobilePage() {
  const { t } = useTranslation();
  return (
    <div>
      <p className="eyebrow mb-1">{t('automobile.dealership')}</p>
      <p className="page-title mb-4">{t('automobile.automobile')}</p>
      <TradeInsTab />
    </div>
  );
}

function TradeInsTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [applying, setApplying] = useState(null);

  function load() {
    setLoading(true);
    api.get('/automobile/trade-ins').then(setCredits).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-ink-muted">{t('automobile.subtitle')}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-base leading-none">add</span>
          {t('automobile.newTradeIn')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && credits.length === 0 && (
        <EmptyState title={t('automobile.noTradeInsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('automobile.addTradeIn')}</button>} />
      )}
      {!loading && credits.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-4 py-2.5 font-semibold">{t('automobile.customer')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('automobile.vehicle')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('automobile.appraisedValue')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('automobile.status')}</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => (
                <tr key={c._id} className="border-t border-rule hover:bg-surface-sunken/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-ink">{c.customerId?.name || '-'}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{c.vehicleDescription || '-'}</td>
                  <td className="px-4 py-2.5 num">{formatMoney(c.appraisedValue, company?.currency)}</td>
                  <td className="px-4 py-2.5">
                    <span className={c.status === 'applied' ? 'chip-accent' : c.status === 'cancelled' ? 'chip-danger' : 'chip-warning'}>{c.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c.status === 'pending' && (
                      <button className="btn-ghost !text-accent !px-0 text-xs font-semibold" onClick={() => setApplying(c)}>{t('automobile.applyToSale')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <TradeInForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {applying && <ApplyForm credit={applying} onClose={() => setApplying(null)} onApplied={() => { setApplying(null); load(); }} />}
    </div>
  );
}

function TradeInForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customerId: '', vehicleDescription: '', appraisedValue: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/automobile/trade-ins', {
        customerId: form.customerId,
        vehicleDescription: form.vehicleDescription,
        appraisedValue: Number(form.appraisedValue),
      });
      toast(t('automobile.tradeInRecorded'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm shadow-lg">
        <p className="page-title text-lg mb-4">{t('automobile.newTradeIn')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('automobile.customer')}</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('automobile.selectEllipsis')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('automobile.vehicleDescription')}</label>
            <input className="field-input" autoFocus value={form.vehicleDescription} onChange={(e) => setForm({ ...form, vehicleDescription: e.target.value })} placeholder={t('automobile.vehicleDescriptionPlaceholder')} />
          </div>
          <div>
            <label className="field-label">{t('automobile.appraisedValue')}</label>
            <input type="number" required min="0" step="0.01" className="field-input num" value={form.appraisedValue} onChange={(e) => setForm({ ...form, appraisedValue: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('automobile.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('automobile.saving') : t('automobile.save')}</button>
        </div>
      </form>
    </div>
  );
}

function ApplyForm({ credit, onClose, onApplied }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [saleId, setSaleId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/automobile/trade-ins/${credit._id}/apply`, { saleId });
      toast(t('automobile.tradeInApplied'), 'success');
      onApplied();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm shadow-lg">
        <p className="page-title text-lg mb-1">{t('automobile.applyTradeInCredit')}</p>
        <p className="text-sm text-ink-muted mb-4 num">{formatMoney(credit.appraisedValue, company?.currency)}: {credit.customerId?.name}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('automobile.saleId')}</label>
            <input required autoFocus className="field-input" value={saleId} onChange={(e) => setSaleId(e.target.value)} placeholder={t('automobile.saleIdPlaceholder')} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('automobile.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('automobile.applying') : t('automobile.apply')}</button>
        </div>
      </form>
    </div>
  );
}
