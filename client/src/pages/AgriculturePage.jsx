import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { growing: 'chip-warning', harvested: 'chip-accent', failed: 'chip-danger' };

export function AgriculturePage() {
  const [tab, setTab] = useState('cycles');
  return (
    <div>
      <p className="eyebrow mb-1">Agriculture</p>
      <p className="page-title mb-5">Farm operations</p>
      <div className="flex gap-2 mb-5">
        {[['cycles', 'Crop cycles'], ['fields', 'Fields']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'cycles' ? <CropCyclesTab /> : <FieldsTab />}
    </div>
  );
}

function CropCyclesTab() {
  const toast = useToast();
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [harvesting, setHarvesting] = useState(null);

  function load() {
    setLoading(true);
    api.get('/agriculture/crop-cycles').then(setCycles).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-base">add</span>
          Start a crop cycle
        </button>
      </div>
      {loading && <Loading />}
      {!loading && cycles.length === 0 && <EmptyState title="No crop cycles yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Plant one</button>} />}
      {!loading && cycles.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">Crop</th>
                <th className="px-4 py-3 font-semibold">Planted</th>
                <th className="px-4 py-3 font-semibold text-right">Expected yield</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{c.cropName}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(c.plantedDate)}</td>
                  <td className="px-4 py-3 num text-right">{c.expectedYield}</td>
                  <td className="px-4 py-3"><span className={STATUS_CHIP[c.status]}>{c.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    {c.status === 'growing' && <button className="btn-ghost !text-accent" onClick={() => setHarvesting(c)}>Complete harvest</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <CropCycleForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {harvesting && <HarvestForm cycle={harvesting} onClose={() => setHarvesting(null)} onSaved={() => { setHarvesting(null); load(); }} />}
    </div>
  );
}

function CropCycleForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [fields, setFields] = useState([]);
  const [boms, setBoms] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ branchId: '', fieldId: '', bomId: '', warehouseId: '', cropName: '', plantedDate: '', expectedYield: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/agriculture/fields').then(setFields).catch(() => {});
    api.get('/manufacturing/boms').then(setBoms).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/agriculture/crop-cycles', { ...form, expectedYield: Number(form.expectedYield) });
      toast('Crop cycle started: raw materials consumed against the BOM.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-bold text-ink mb-4">Start a crop cycle</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, warehouseId: '' })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Field</label>
            <select required className="field-input" value={form.fieldId} onChange={(e) => setForm({ ...form, fieldId: e.target.value })}>
              <option value="">Select…</option>
              {fields.map((f) => <option key={f._id} value={f._id}>{f.name}: {f.areaAcres} acres</option>)}
            </select>
          </div>
          <div><label className="field-label">Crop name</label><input required className="field-input" value={form.cropName} onChange={(e) => setForm({ ...form, cropName: e.target.value })} /></div>
          <div>
            <label className="field-label">BOM (seeds, fertilizer: consumed immediately)</label>
            <select required className="field-input" value={form.bomId} onChange={(e) => setForm({ ...form, bomId: e.target.value })}>
              <option value="">Select…</option>
              {boms.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse (raw materials consumed from)</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Planted date</label><input type="date" required className="field-input" value={form.plantedDate} onChange={(e) => setForm({ ...form, plantedDate: e.target.value })} /></div>
            <div><label className="field-label">Expected yield</label><input type="number" required className="field-input num" value={form.expectedYield} onChange={(e) => setForm({ ...form, expectedYield: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Planting…' : 'Start cycle'}</button>
        </div>
      </form>
    </div>
  );
}

function HarvestForm({ cycle, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ actualYield: '', actualLaborCost: '', actualOverheadCost: '', wastageNote: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/agriculture/crop-cycles/${cycle._id}/harvest`, {
        actualYield: Number(form.actualYield),
        actualLaborCost: form.actualLaborCost ? Number(form.actualLaborCost) : undefined,
        actualOverheadCost: form.actualOverheadCost ? Number(form.actualOverheadCost) : undefined,
        wastageNote: form.wastageNote || undefined,
      });
      toast('Harvest completed.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-1">Complete harvest</p>
        <p className="text-sm text-ink-muted mb-4">{cycle.cropName}: expected {cycle.expectedYield}</p>
        <div className="space-y-3">
          <div><label className="field-label">Actual yield</label><input type="number" required className="field-input num" value={form.actualYield} onChange={(e) => setForm({ ...form, actualYield: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Labor cost</label><input type="number" className="field-input num" value={form.actualLaborCost} onChange={(e) => setForm({ ...form, actualLaborCost: e.target.value })} /></div>
            <div><label className="field-label">Overhead cost</label><input type="number" className="field-input num" value={form.actualOverheadCost} onChange={(e) => setForm({ ...form, actualOverheadCost: e.target.value })} /></div>
          </div>
          <div><label className="field-label">Wastage note (optional)</label><input className="field-input" value={form.wastageNote} onChange={(e) => setForm({ ...form, wastageNote: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Completing…' : 'Complete harvest'}</button>
        </div>
      </form>
    </div>
  );
}

function FieldsTab() {
  const toast = useToast();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(null);

  function load() {
    setLoading(true);
    api.get('/agriculture/fields').then(setFields).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-base">add</span>
          Add field
        </button>
      </div>
      {loading && <Loading />}
      {!loading && fields.length === 0 && <EmptyState title="No fields yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add one</button>} />}
      {!loading && fields.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {fields.map((f) => (
            <div key={f._id} className="card p-4 cursor-pointer hover:border-accent transition-colors" onClick={() => setViewingHistory(f)}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent-strong flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">grass</span>
                </div>
                <p className="text-sm font-semibold text-ink">{f.name}</p>
              </div>
              <p className="num text-sm text-ink-muted">{f.areaAcres} acres</p>
              <p className="text-xs font-semibold text-accent-strong mt-2">View yield history →</p>
            </div>
          ))}
        </div>
      )}
      {showForm && <FieldForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {viewingHistory && <YieldHistoryPanel field={viewingHistory} onClose={() => setViewingHistory(null)} />}
    </div>
  );
}

function FieldForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', name: '', areaAcres: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/agriculture/fields', { ...form, areaAcres: Number(form.areaAcres) });
      toast('Field added.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">Add field</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Name</label><input required className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Area (acres)</label><input type="number" required className="field-input num" value={form.areaAcres} onChange={(e) => setForm({ ...form, areaAcres: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function YieldHistoryPanel({ field, onClose }) {
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/agriculture/fields/${field._id}/yield-history`).then(setData).catch((err) => toast(err.message, 'error'));
  }, [field._id]);

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg font-bold text-ink">{field.name}: yield history</p>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        {!data && <Loading />}
        {data && data.history.length === 0 && <EmptyState title="No harvested cycles yet" />}
        {data && data.history.length > 0 && (
          <>
            {data.latestVsHistoryPercent !== null && (
              <p className={`text-sm mb-3 ${data.latestVsHistoryPercent >= 0 ? 'text-accent-strong' : 'text-danger'}`}>
                Latest harvest is {data.latestVsHistoryPercent >= 0 ? 'up' : 'down'} {Math.abs(data.latestVsHistoryPercent)}% per acre vs. the historical average ({data.historicalAverageYieldPerAcre}/acre).
              </p>
            )}
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Crop</th>
                    <th className="px-4 py-3 font-semibold">Planted</th>
                    <th className="px-4 py-3 font-semibold text-right">Yield</th>
                    <th className="px-4 py-3 font-semibold text-right">Per acre</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.cropCycleId} className="border-b border-rule last:border-0">
                      <td className="px-4 py-3">{h.cropName}</td>
                      <td className="px-4 py-3 text-ink-muted">{formatDate(h.plantedDate)}</td>
                      <td className="px-4 py-3 num text-right">{h.actualYield}</td>
                      <td className="px-4 py-3 num text-right">{h.yieldPerAcre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
