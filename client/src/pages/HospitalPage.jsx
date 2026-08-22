import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function HospitalPage() {
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
      toast('Next patient called in.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">OPD Queue</p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={callNext} disabled={queue.length === 0}>Call next</button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>Check in patient</button>
        </div>
      </div>
      {loading && <Loading />}
      {!loading && queue.length === 0 && <EmptyState title="No one waiting" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Check in a patient</button>} />}
      {!loading && queue.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide"><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Patient</th><th className="px-3 py-2 font-medium">Complaint</th><th className="px-3 py-2 font-medium"></th></tr></thead>
            <tbody>
              {queue.map((v) => (
                <tr key={v._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2 num">{v.queueNumber}</td>
                  <td className="px-3 py-2">{v.customerId?.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{v.chiefComplaint || '—'}</td>
                  <td className="px-3 py-2 text-right"><span className={v.status === 'waiting' ? 'chip-neutral' : 'chip-warning'}>{v.status.replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <CheckInForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CheckInForm({ onClose, onSaved }) {
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
      if (!product) throw new Error('Select a consultation billing product.');
      await api.post('/hospital/visits/check-in', { ...form, consultationFee: Number(form.consultationFee), billingVariantId: product.variants[0]?._id });
      toast('Patient checked in.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Check in patient</p>
        <div className="space-y-3">
          <div><label className="field-label">Branch</label><select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Select…</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></div>
          <div><label className="field-label">Patient</label><select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Select…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
          <div><label className="field-label">Chief complaint</label><input className="field-input" value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} /></div>
          <div>
            <label className="field-label">Consultation billing product (trackingMode "service")</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}><option value="">Select…</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
          </div>
          <div><label className="field-label">Consultation fee</label><input type="number" className="field-input num" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Checking in…' : 'Check in'}</button></div>
      </form>
    </div>
  );
}
