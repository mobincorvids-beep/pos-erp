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

  async function handleRemove(u) {
    if (!window.confirm(`Remove "${u.name}"? Products already using it keep their reference.`)) return;
    try {
      await api.del(`/units/${u._id}`);
      toast('Unit removed.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <p className="page-title">Units</p>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">A base unit stands alone (Piece, Kilogram). An alternate unit converts to a base unit — a Carton of 288 Pieces — so you can buy in cartons while everything is tracked and costed in pieces underneath.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          New unit
        </button>
      </div>

      {loading && <Loading />}
      {!loading && units.length === 0 && (
        <EmptyState title="No units yet" description="Create a base unit first (Piece, Kg), then alternate units that convert to it." action={<button className="btn-primary" onClick={() => setShowForm(true)}>New unit</button>} />
      )}
      {!loading && units.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">Unit Register</p>
            <span className="eyebrow">{units.length} units</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">Name</th>
                  <th className="py-3 px-5 eyebrow font-medium">Code</th>
                  <th className="py-3 px-5 eyebrow font-medium">Converts to</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {units.map((u) => (
                  <tr key={u._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5 text-sm font-semibold text-ink">{u.name}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted num">{u.shortCode}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted">
                      {u.baseUnitId ? <span className="num">1 {u.name} = {u.conversionFactor} {u.baseUnitId.name}</span> : <span className="chip-neutral">Base unit</span>}
                    </td>
                    <td className="py-3 px-5 text-right"><button className="btn-ghost !text-danger text-xs" onClick={() => handleRemove(u)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        <p className="font-display text-lg font-bold text-ink mb-4">New unit</p>
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
