import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

export function GymPage() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClassForm, setShowClassForm] = useState(false);
  const [scheduling, setScheduling] = useState(null);
  const [roster, setRoster] = useState(null);

  function load() {
    setLoading(true);
    api.get('/gym/classes').then(setClasses).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex justify-end mb-3"><button className="btn-primary" onClick={() => setShowClassForm(true)}>New class</button></div>
        {loading && <Loading />}
        {!loading && classes.length === 0 && <EmptyState title="No classes yet" action={<button className="btn-primary" onClick={() => setShowClassForm(true)}>Add a class</button>} />}
        {!loading && classes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {classes.map((c) => (
              <div key={c._id} className="card p-3">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-ink-muted">Capacity {c.capacity}</p>
                <button className="btn-ghost !text-accent !px-0 text-xs mt-2" onClick={() => setScheduling(c)}>Schedule session</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {showClassForm && <ClassForm onClose={() => setShowClassForm(false)} onSaved={() => { setShowClassForm(false); load(); }} />}
      {scheduling && <SessionScheduler gymClass={scheduling} onClose={() => setScheduling(null)} onScheduled={(s) => { setScheduling(null); setRoster(s); }} />}
      {roster && <RosterPanel sessionId={roster._id} onClose={() => setRoster(null)} />}
    </div>
  );
}

function ClassForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', name: '', capacity: 10, durationMinutes: 60 });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/gym/classes', { ...form, capacity: Number(form.capacity), durationMinutes: Number(form.durationMinutes) });
      toast('Class created.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs">
        <p className="font-display text-lg mb-4">New class</p>
        <div className="space-y-3">
          <div><label className="field-label">Branch</label><select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Select…</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></div>
          <div><label className="field-label">Name</label><input required className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Morning Yoga" /></div>
          <div><label className="field-label">Capacity</label><input type="number" className="field-input num" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button></div>
      </form>
    </div>
  );
}

function SessionScheduler({ gymClass, onClose, onScheduled }) {
  const toast = useToast();
  const [startTime, setStartTime] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const session = await api.post(`/gym/classes/${gymClass._id}/sessions`, { startTime });
      toast('Session scheduled.', 'success');
      onScheduled(session);
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs">
        <p className="font-display text-lg mb-1">Schedule session</p>
        <p className="text-sm text-ink-muted mb-4">{gymClass.name}</p>
        <label className="field-label">Start time</label>
        <input type="datetime-local" required className="field-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Scheduling…' : 'Schedule'}</button></div>
      </form>
    </div>
  );
}

function RosterPanel({ sessionId, onClose }) {
  const toast = useToast();
  const [roster, setRoster] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/gym/sessions/${sessionId}/roster`).then(setRoster).catch((err) => toast(err.message, 'error'));
  }
  useEffect(() => { load(); api.get('/customers').then(setCustomers).catch(() => {}); }, [sessionId]);

  async function enroll() {
    setBusy(true);
    try {
      const result = await api.post(`/gym/sessions/${sessionId}/enroll`, { customerId });
      toast(result.enrolled ? 'Enrolled!' : `Waitlisted at position ${result.waitlistPosition}.`, result.enrolled ? 'success' : 'warning');
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  if (!roster) return null;
  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3"><p className="font-display text-lg">Roster</p><button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button></div>
      <div className="flex gap-2 mb-4">
        <select className="field-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Select customer…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
        <button className="btn-primary shrink-0" disabled={!customerId || busy} onClick={enroll}>Enroll</button>
      </div>
      <p className="text-xs text-ink-muted uppercase tracking-wide mb-1">Enrolled ({roster.enrolledCustomerIds.length}/{roster.capacity})</p>
      {roster.enrolledCustomerIds.map((c) => <div key={c._id} className="text-sm py-1 border-b border-rule">{c.name}</div>)}
      {roster.waitlistCustomerIds.length > 0 && (
        <>
          <p className="text-xs text-ink-muted uppercase tracking-wide mt-3 mb-1">Waitlist</p>
          {roster.waitlistCustomerIds.map((c, i) => <div key={c._id} className="text-sm py-1 border-b border-rule">{i + 1}. {c.name}</div>)}
        </>
      )}
    </div>
  );
}
