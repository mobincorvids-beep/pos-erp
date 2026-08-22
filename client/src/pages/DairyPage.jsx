import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function DairyPage() {
  const [tab, setTab] = useState('collections');
  const [schedules, setSchedules] = useState([]);

  useEffect(() => { api.get('/dairy/quality-schedules').then(setSchedules).catch(() => {}); }, []);

  return (
    <div>
      <p className="page-title mb-4">Dairy</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['collections', 'Collections'], ['schedules', 'Quality schedules']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'collections' && <CollectionsTab schedules={schedules} />}
      {tab === 'schedules' && <SchedulesTab schedules={schedules} setSchedules={setSchedules} />}
    </div>
  );
}

function SchedulesTab({ schedules, setSchedules }) {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);

  // Schedules are loaded fresh from the real endpoint on mount (see
  // DairyPage above) — created here, they're appended to that same
  // state so the Collections tab sees them immediately, without waiting
  // for a refetch.
  function handleSaved(schedule) {
    setSchedules((prev) => [schedule, ...prev]);
    setShowForm(false);
    toast('Quality schedule created.', 'success');
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>New schedule</button>
      </div>
      {schedules.length === 0 && !showForm && (
        <EmptyState title="No quality schedules yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add a schedule</button>} />
      )}
      {schedules.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {schedules.map((s) => (
            <div key={s._id} className="card p-3">
              <p className="text-sm font-medium mb-2">{s.name}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-muted uppercase tracking-wide">
                    <th className="font-medium pr-2 py-1">Min fat %</th>
                    <th className="font-medium py-1">Price / litre</th>
                  </tr>
                </thead>
                <tbody>
                  {s.bands.map((b, i) => (
                    <tr key={i} className="border-t border-rule">
                      <td className="pr-2 py-1 num">{b.minFatPercent}%</td>
                      <td className="py-1 num">{formatMoney(b.pricePerLitre)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {showForm && <ScheduleForm onClose={() => setShowForm(false)} onSaved={handleSaved} />}
    </div>
  );
}

function ScheduleForm({ onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [bands, setBands] = useState([{ minFatPercent: '', pricePerLitre: '' }]);
  const [saving, setSaving] = useState(false);

  function updateBand(index, field, value) {
    setBands((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }
  function addBand() {
    setBands((prev) => [...prev, { minFatPercent: '', pricePerLitre: '' }]);
  }
  function removeBand(index) {
    setBands((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payloadBands = bands.map((b) => ({
        minFatPercent: Number(b.minFatPercent),
        pricePerLitre: Number(b.pricePerLitre),
      }));
      const schedule = await api.post('/dairy/quality-schedules', { name, bands: payloadBands });
      onSaved(schedule);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-md">
        <p className="font-display text-lg mb-4">New quality schedule</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Name</label>
            <input required autoFocus className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard grading" />
          </div>
          <div>
            <label className="field-label">Bands (highest fat % met determines price)</label>
            <div className="space-y-2">
              {bands.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="number" step="0.1" required className="field-input num" placeholder="Min fat %" value={b.minFatPercent} onChange={(e) => updateBand(i, 'minFatPercent', e.target.value)} />
                  <input type="number" step="0.01" required className="field-input num" placeholder="Price / litre" value={b.pricePerLitre} onChange={(e) => updateBand(i, 'pricePerLitre', e.target.value)} />
                  <button type="button" className="btn-ghost !px-2 text-xs" disabled={bands.length === 1} onClick={() => removeBand(i)}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-ghost !text-accent !px-0 text-xs mt-2" onClick={addBand}>+ Add band</button>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function CollectionsTab({ schedules }) {
  const { company } = useAuth();
  const toast = useToast();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/dairy/collections').then(setCollections).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>Record collection</button>
      </div>
      {loading && <Loading />}
      {!loading && collections.length === 0 && (
        <EmptyState title="No collections recorded yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Record a collection</button>} />
      )}
      {!loading && collections.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Supplier</th>
                <th className="px-3 py-2 font-medium">Litres</th>
                <th className="px-3 py-2 font-medium">Fat %</th>
                <th className="px-3 py-2 font-medium">Price / litre</th>
                <th className="px-3 py-2 font-medium">Total payable</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{c.supplierId?.name || '—'}</td>
                  <td className="px-3 py-2 num">{c.litres}</td>
                  <td className="px-3 py-2 num">{c.fatPercent}%</td>
                  <td className="px-3 py-2 num">{c.pricePerLitre != null ? formatMoney(c.pricePerLitre, company?.currency) : '—'}</td>
                  <td className="px-3 py-2 num">{c.totalPayable != null ? formatMoney(c.totalPayable, company?.currency) : '—'}</td>
                  <td className="px-3 py-2"><span className={c.paid ? 'chip-accent' : 'chip-warning'}>{c.paid ? 'paid' : 'unpaid'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <CollectionForm schedules={schedules} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CollectionForm({ schedules, onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ branchId: '', supplierId: '', litres: '', fatPercent: '', scheduleId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/suppliers').then(setSuppliers).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/dairy/collections', {
        ...form,
        litres: Number(form.litres),
        fatPercent: Number(form.fatPercent),
      });
      toast('Collection recorded.', 'success');
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
        <p className="font-display text-lg mb-4">Record collection</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Supplier</label>
            <select required className="field-input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">Select…</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Litres</label><input type="number" step="0.01" required className="field-input num" value={form.litres} onChange={(e) => setForm({ ...form, litres: e.target.value })} /></div>
            <div><label className="field-label">Fat %</label><input type="number" step="0.01" required className="field-input num" value={form.fatPercent} onChange={(e) => setForm({ ...form, fatPercent: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">Quality schedule</label>
            <select required className="field-input" value={form.scheduleId} onChange={(e) => setForm({ ...form, scheduleId: e.target.value })}>
              <option value="">Select…</option>
              {schedules.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            {schedules.length === 0 && <p className="text-xs text-warning mt-1">Create a quality schedule on the Quality schedules tab first.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
