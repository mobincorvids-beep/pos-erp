import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

const STATUS_CHIP = { free: 'chip-accent', occupied: 'chip-warning', reserved: 'chip-neutral' };
const NEXT_STATUS = { free: 'occupied', occupied: 'free', reserved: 'occupied' };

export function RestaurantPage() {
  const toast = useToast();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/restaurant/tables').then(setTables).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function cycleStatus(table) {
    try {
      await api.patch(`/restaurant/tables/${table._id}/status`, { status: NEXT_STATUS[table.status] || 'free' });
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function setReserved(table) {
    try {
      await api.patch(`/restaurant/tables/${table._id}/status`, { status: 'reserved' });
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Tables</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Add table</button>
      </div>

      {loading && <Loading />}
      {!loading && tables.length === 0 && (
        <EmptyState title="No tables yet" description="Set up your floor before opening for service." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add a table</button>} />
      )}
      {!loading && tables.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tables.map((t) => (
            <div key={t._id} className="card p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">{t.name}</p>
                <span className={STATUS_CHIP[t.status]}>{t.status}</span>
              </div>
              <p className="text-xs text-ink-muted mb-2">{t.seats} seats</p>
              <div className="flex gap-1">
                <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => cycleStatus(t)}>
                  Mark {NEXT_STATUS[t.status] || 'free'}
                </button>
                {t.status === 'free' && (
                  <button className="btn-ghost !text-ink-muted !px-0 text-xs" onClick={() => setReserved(t)}>Reserve</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && <TableForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function TableForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', name: '', seats: 4 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/restaurant/tables', { ...form, seats: Number(form.seats) });
      toast('Table added.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs">
        <p className="font-display text-lg mb-4">Add table</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Table 4" /></div>
          <div><label className="field-label">Seats</label><input type="number" min="1" className="field-input num" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding…' : 'Add'}</button>
        </div>
      </form>
    </div>
  );
}
