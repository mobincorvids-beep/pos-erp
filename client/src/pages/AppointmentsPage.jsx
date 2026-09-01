import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDateTime } from '../lib/format';

const STATUS_CHIP = { scheduled: 'chip-neutral', confirmed: 'chip-info', completed: 'chip-accent', cancelled: 'chip-danger', no_show: 'chip-warning' };

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="page-title">Appointments</p>
          <p className="text-sm text-ink-muted mt-1">Real-time scheduling and staff double-booking prevention.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          Book appointment
        </button>
      </div>

      {loading && <Loading />}
      {!loading && appointments.length === 0 && (
        <EmptyState title="No appointments yet" description="Book appointments with automatic staff double-booking prevention." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Book one</button>} />
      )}
      {!loading && appointments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex items-center justify-between bg-surface">
            <p className="font-display text-lg font-semibold text-ink">Daily queue</p>
            <span className="eyebrow">{appointments.length} total</span>
          </div>
          <div className="divide-y divide-rule">
            {appointments.map((a) => {
              const isActive = a.status === 'confirmed';
              return (
                <div
                  key={a._id}
                  className={
                    isActive
                      ? 'p-4 flex items-center gap-4 bg-accent-soft border-l-4 border-accent'
                      : 'p-4 flex items-center gap-4 border-l-4 border-transparent hover:bg-surface-sunken transition-colors'
                  }
                >
                  <div className="w-10 h-10 shrink-0 rounded-full bg-surface-sunken flex items-center justify-center text-sm font-semibold text-ink font-display">
                    {initials(a.customerName || a.serviceName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink-muted num">{formatDateTime(a.startTime)}</span>
                      <span className={STATUS_CHIP[a.status]}>{a.status.replace('_', ' ')}</span>
                    </div>
                    <p className="font-semibold text-ink mt-1 truncate">{a.serviceName}</p>
                  </div>
                  <div className="shrink-0 flex gap-2">
                    {a.status === 'scheduled' && (
                      <>
                        <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => updateStatus(a._id, 'confirmed')}>Confirm</button>
                        <button className="btn-ghost !text-danger !py-1.5 !px-3 text-xs" onClick={() => updateStatus(a._id, 'cancelled')}>Cancel</button>
                      </>
                    )}
                    {a.status === 'confirmed' && (
                      <>
                        <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => updateStatus(a._id, 'completed')}>Complete</button>
                        <button className="btn-ghost !text-warning !py-1.5 !px-3 text-xs" onClick={() => updateStatus(a._id, 'no_show')}>No-show</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
        <p className="font-display text-lg font-semibold text-ink mb-4">Book appointment</p>
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
