import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function UnitsPage() {
  const toast = useToast();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/units').then(setUnits).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Units</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New unit</button>
      </div>
      <p className="text-sm text-ink-muted mb-5 max-w-2xl">A base unit stands alone (Piece, Kilogram). An alternate unit converts to a base unit — a Carton of 288 Pieces — so you can buy in cartons while everything is tracked and costed in pieces underneath.</p>

      {loading && <Loading />}
      {!loading && units.length === 0 && (
        <EmptyState title="No units yet" description="Create a base unit first (Piece, Kg), then alternate units that convert to it." action={<button className="btn-primary" onClick={() => setShowForm(true)}>New unit</button>} />
      )}
      {!loading && units.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Converts to</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{u.shortCode}</td>
                  <td className="px-3 py-2 text-ink-muted">
                    {u.baseUnitId ? `1 ${u.name} = ${u.conversionFactor} ${u.baseUnitId.name}` : <span className="chip-neutral">Base unit</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <UnitForm units={units} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function UnitForm({ units, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', shortCode: '', baseUnitId: '', conversionFactor: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/units', {
        name: form.name, shortCode: form.shortCode,
        baseUnitId: form.baseUnitId || undefined,
        conversionFactor: form.baseUnitId ? Number(form.conversionFactor) : undefined,
      });
      toast('Unit created.', 'success');
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
        <p className="font-display text-lg mb-4">New unit</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Name</label>
              <input required placeholder="Carton" className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Code</label>
              <input required placeholder="ctn" className="field-input" value={form.shortCode} onChange={(e) => setForm({ ...form, shortCode: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Converts to (optional — leave blank for a base unit)</label>
            <select className="field-input" value={form.baseUnitId} onChange={(e) => setForm({ ...form, baseUnitId: e.target.value })}>
              <option value="">This is a base unit</option>
              {units.filter((u) => !u.baseUnitId).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          {form.baseUnitId && (
            <div>
              <label className="field-label">1 {form.name || 'unit'} equals how many {units.find((u) => u._id === form.baseUnitId)?.name}?</label>
              <input type="number" step="0.0001" min="0.0001" required className="field-input num" value={form.conversionFactor} onChange={(e) => setForm({ ...form, conversionFactor: e.target.value })} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
