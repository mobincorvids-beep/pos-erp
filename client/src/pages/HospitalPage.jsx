import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function HospitalPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [completing, setCompleting] = useState(null);

  function load() {
    setLoading(true);
    api.get('/hospital/visits/queue').then(setQueue).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function callNext() {
    try {
      const branchId = queue[0]?.branchId;
      await api.post('/hospital/visits/call-next', { branchId });
      toast(t('hospital.nextPatientCalledIn'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="eyebrow mb-1">{t('hospital.outpatientDepartment')}</p>
          <p className="page-title">{t('hospital.opdQueue')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={callNext} disabled={queue.length === 0}>{t('hospital.callNext')}</button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>{t('hospital.checkInPatient')}</button>
        </div>
      </div>

      {loading && <Loading />}
      {!loading && queue.length === 0 && <EmptyState title={t('hospital.noOneWaiting')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('hospital.checkInAPatient')}</button>} />}
      {!loading && queue.length > 0 && (
        <div className="card divide-y divide-rule overflow-hidden">
          {queue.map((v, i) => (
            <div
              key={v._id}
              className={
                i === 0
                  ? 'relative flex items-center justify-between gap-4 border-l-4 border-accent bg-accent-soft/40 px-4 py-3'
                  : 'relative flex items-center justify-between gap-4 border-l-4 border-transparent px-4 py-3'
              }
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-sm font-semibold text-ink">
                  {v.queueNumber}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{v.customerId?.name}</p>
                  <p className="text-sm text-ink-muted truncate">{v.chiefComplaint || t('hospital.noComplaintNoted')}</p>
                </div>
              </div>
              <span className={v.status === 'waiting' ? 'chip-neutral shrink-0' : 'chip-warning shrink-0'}>
                {v.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {showForm && <CheckInForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CheckInForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ branchId: '', customerId: '', chiefComplaint: '', consultationFee: 2000, billingProductId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.billingProductId);
      if (!product) throw new Error(t('hospital.selectConsultationBillingProduct'));
      await api.post('/hospital/visits/check-in', { ...form, consultationFee: Number(form.consultationFee), billingVariantId: product.variants[0]?._id });
      toast(t('hospital.patientCheckedIn'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('hospital.checkInPatient')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('hospital.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('hospital.select')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('hospital.patient')}</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('hospital.select')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('hospital.chiefComplaint')}</label>
            <input className="field-input" value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('hospital.consultationBillingProduct')}</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}>
              <option value="">{t('hospital.select')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('hospital.consultationFee')}</label>
            <input type="number" className="field-input num" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hospital.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hospital.checkingIn') : t('hospital.checkIn')}</button>
        </div>
      </form>
    </div>
  );
}
