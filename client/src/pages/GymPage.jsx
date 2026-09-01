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
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit
  const [scheduling, setScheduling] = useState(null);
  const [roster, setRoster] = useState(null);

  function load() {
    setLoading(true);
    api.get('/gym/classes').then(setClasses).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleRemove(c) {
    if (!window.confirm(`Remove "${c.name}"? Already-scheduled sessions are unaffected.`)) return;
    try {
      await api.del(`/gym/classes/${c._id}`);
      toast('Class removed.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow">Gym</p>
            <h1 className="page-title">Classes</h1>
          </div>
          <button className="btn-primary" onClick={() => setEditing({})}>New class</button>
        </div>
        {loading && <Loading />}
        {!loading && classes.length === 0 && <EmptyState title="No classes yet" action={<button className="btn-primary" onClick={() => setEditing({})}>Add a class</button>} />}
        {!loading && classes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {classes.map((c) => (
              <div key={c._id} className="card p-4 flex flex-col gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{c.name}</p>
                  <span className="chip-neutral mt-1 num">Capacity {c.capacity}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 pt-2 border-t border-rule">
                  <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setScheduling(c)}>Schedule session</button>
                  <button className="text-xs font-semibold text-ink-muted hover:text-ink" onClick={() => setEditing(c)}>Edit</button>
                  <button className="text-xs font-semibold text-danger hover:opacity-80" onClick={() => handleRemove(c)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {editing !== null && <ClassForm gymClass={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {scheduling && <SessionScheduler gymClass={scheduling} onClose={() => setScheduling(null)} onScheduled={(s) => { setScheduling(null); setRoster(s); }} />}
      {roster && <RosterPanel sessionId={roster._id} onClose={() => setRoster(null)} />}
    </div>
  );
}

function ClassForm({ gymClass, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !gymClass._id;
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: gymClass.branchId || '', name: gymClass.name || '', capacity: gymClass.capacity ?? 10, durationMinutes: gymClass.durationMinutes ?? 60 });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (isNew) api.get('/org/branches').then(setBranches).catch(() => {}); }, [isNew]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/gym/classes', { ...form, capacity: Number(form.capacity), durationMinutes: Number(form.durationMinutes) });
        toast('Class created.', 'success');
      } else {
        await api.put(`/gym/classes/${gymClass._id}`, { name: form.name, capacity: Number(form.capacity), durationMinutes: Number(form.durationMinutes) });
        toast('Class updated.', 'success');
      }
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs">
        <p className="font-display text-lg font-bold text-ink mb-4">{isNew ? 'New class' : 'Edit class'}</p>
        <div className="space-y-3">
          {isNew && <div><label className="field-label">Branch</label><select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Select…</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></div>}
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
        <p className="font-display text-lg font-bold text-ink mb-1">Schedule session</p>
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

  async function cancelSession() {
    if (!window.confirm('Cancel this entire session? Everyone enrolled or waitlisted will need to be notified separately.')) return;
    try {
      await api.post(`/gym/sessions/${sessionId}/cancel`);
      toast('Session cancelled.', 'success');
      onClose();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (!roster) return null;
  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3"><p className="font-display text-lg font-bold text-ink">Roster</p><button className="btn-ghost !px-2 !py-1 text-sm" onClick={onClose}>Close</button></div>
      <div className="flex gap-2 mb-4">
        <select className="field-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Select customer…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
        <button className="btn-primary shrink-0" disabled={!customerId || busy} onClick={enroll}>Enroll</button>
      </div>
      <p className="eyebrow mb-1">Enrolled (<span className="num">{roster.enrolledCustomerIds.length}/{roster.capacity}</span>)</p>
      {roster.enrolledCustomerIds.map((c) => <div key={c._id} className="text-sm text-ink py-1.5 border-b border-rule">{c.name}</div>)}
      {roster.waitlistCustomerIds.length > 0 && (
        <>
          <p className="eyebrow mt-3 mb-1">Waitlist</p>
          {roster.waitlistCustomerIds.map((c, i) => <div key={c._id} className="text-sm text-ink py-1.5 border-b border-rule"><span className="num">{i + 1}.</span> {c.name}</div>)}
        </>
      )}
      <button className="btn-secondary w-full mt-4" onClick={cancelSession}>Cancel this session</button>
    </div>
  );
}
