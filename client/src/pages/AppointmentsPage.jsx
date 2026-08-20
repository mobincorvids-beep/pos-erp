import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDateTime } from '../lib/format';

const STATUS_CHIP = { scheduled: 'chip-neutral', confirmed: 'chip-info', completed: 'chip-accent', cancelled: 'chip-danger', no_show: 'chip-warning' };

export function AppointmentsPage() {
  const toast = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/appointments').then(setAppointments).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function updateStatus(id, status) {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      toast('Status updated.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Appointments</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Book appointment</button>
      </div>

      {loading && <Loading />}
      {!loading && appointments.length === 0 && (
        <EmptyState title="No appointments yet" description="Book appointments with automatic staff double-booking prevention." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Book one</button>} />
      )}
      {!loading && appointments.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Service</th>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{a.serviceName}</td>
                  <td className="px-3 py-2 text-ink-muted">{formatDateTime(a.startTime)}</td>
                  <td className="px-3 py-2"><span className={STATUS_CHIP[a.status]}>{a.status.replace('_', ' ')}</span></td>
                  <td className="px-3 py-2 text-right">
                    {a.status === 'scheduled' && (
                      <div className="flex gap-1 justify-end">
                        <button className="btn-ghost !text-accent" onClick={() => updateStatus(a._id, 'confirmed')}>Confirm</button>
                        <button className="btn-ghost !text-danger" onClick={() => updateStatus(a._id, 'cancelled')}>Cancel</button>
                      </div>
                    )}
                    {a.status === 'confirmed' && (
                      <div className="flex gap-1 justify-end">
                        <button className="btn-ghost !text-accent" onClick={() => updateStatus(a._id, 'completed')}>Complete</button>
                        <button className="btn-ghost !text-warning" onClick={() => updateStatus(a._id, 'no_show')}>No-show</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <AppointmentForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function AppointmentForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ branchId: '', staffUserId: '', customerId: '', serviceName: '', startTime: '', endTime: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/users').then(setStaff).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/appointments', { ...form, customerId: form.customerId || undefined });
      toast('Appointment booked.', 'success');
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
        <p className="font-display text-lg mb-4">Book appointment</p>
        <div className="space-y-3">
          <div><label className="field-label">Service</label><input required autoFocus className="field-input" value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} placeholder="e.g. Haircut" /></div>
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Staff member</label>
            <select required className="field-input" value={form.staffUserId} onChange={(e) => setForm({ ...form, staffUserId: e.target.value })}>
              <option value="">Select…</option>
              {staff.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Walk-in</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Start</label><input type="datetime-local" required className="field-input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><label className="field-label">End</label><input type="datetime-local" required className="field-input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Booking…' : 'Book'}</button>
        </div>
      </form>
    </div>
  );
}
