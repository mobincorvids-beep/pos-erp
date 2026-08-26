import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function CalendarPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    const from = new Date(); from.setDate(from.getDate() - 7);
    const to = new Date(); to.setDate(to.getDate() + 60);
    api.get(`/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(setEvents).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function respond(eventId, response) {
    try { await api.post(`/calendar/events/${eventId}/respond`, { response }); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function cancelEvent(eventId) {
    if (!confirm('Cancel this meeting? Attendees will be notified.')) return;
    try { await api.post(`/calendar/events/${eventId}/cancel`); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="font-display text-lg">Calendar</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New meeting</button>
      </div>

      {loading && <Loading />}
      {!loading && events.length === 0 && <EmptyState title="No upcoming meetings" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Schedule one</button>} />}

      {!loading && events.length > 0 && (
        <div className="space-y-2">
          {events.map((ev) => {
            const isOrganizer = ev.organizerId?._id === user._id;
            const myResponse = ev.attendeeResponses.find((a) => a.userId?._id === user._id)?.response;
            return (
              <div key={ev._id} className="card p-3 flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">{ev.title}</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {new Date(ev.startTime).toLocaleString()} → {new Date(ev.endTime).toLocaleTimeString()}
                    {ev.location && ` · ${ev.location}`}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Organizer: {ev.organizerId?.name}{isOrganizer && ' (you)'}
                    {ev.attendeeResponses.length > 0 && ` · ${ev.attendeeResponses.length} invited`}
                  </p>
                  {ev.meetingUrl && <a href={ev.meetingUrl} target="_blank" rel="noreferrer" className="text-xs text-accent">Join link</a>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!isOrganizer && myResponse === 'pending' && (
                    <div className="flex gap-2">
                      <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => respond(ev._id, 'accepted')}>Accept</button>
                      <button className="btn-ghost !text-red-600 !px-0 text-xs" onClick={() => respond(ev._id, 'declined')}>Decline</button>
                    </div>
                  )}
                  {!isOrganizer && myResponse !== 'pending' && <span className={`chip-${myResponse === 'accepted' ? 'accent' : 'neutral'} text-[10px]`}>{myResponse}</span>}
                  {isOrganizer && (
                    <div className="flex gap-2">
                      <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setEditing(ev)}>Edit</button>
                      <button className="btn-ghost !text-red-600 !px-0 text-xs" onClick={() => cancelEvent(ev._id)}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <EventForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <EventForm event={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function EventForm({ event, onClose, onSaved }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(event ? {
    title: event.title, description: event.description || '',
    startTime: event.startTime.slice(0, 16), endTime: event.endTime.slice(0, 16),
    location: event.location || '', meetingUrl: event.meetingUrl || '',
    attendeeUserIds: event.attendeeResponses.map((a) => a.userId?._id),
  } : { title: '', description: '', startTime: '', endTime: '', location: '', meetingUrl: '', attendeeUserIds: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/users').then(setUsers).catch(() => {}); }, []);

  function toggleAttendee(id) {
    setForm((f) => ({ ...f, attendeeUserIds: f.attendeeUserIds.includes(id) ? f.attendeeUserIds.filter((x) => x !== id) : [...f.attendeeUserIds, id] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (event) await api.put(`/calendar/events/${event._id}`, form);
      else await api.post('/calendar/events', form);
      toast(event ? 'Meeting updated.' : 'Meeting scheduled.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">{event ? 'Edit meeting' : 'New meeting'}</p>
        <div className="space-y-3">
          <div><label className="field-label">Title</label><input required className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="field-label">Description</label><textarea className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Start</label><input type="datetime-local" required className="field-input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><label className="field-label">End</label><input type="datetime-local" required className="field-input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          </div>
          <div><label className="field-label">Location (optional)</label><input className="field-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div><label className="field-label">Meeting link (optional)</label><input className="field-input" value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} /></div>
          {!event && (
            <div>
              <label className="field-label">Invite</label>
              <div className="max-h-32 overflow-y-auto border border-ink/10 rounded p-2 space-y-1">
                {users.map((u) => (
                  <label key={u._id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.attendeeUserIds.includes(u._id)} onChange={() => toggleAttendee(u._id)} /> {u.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
