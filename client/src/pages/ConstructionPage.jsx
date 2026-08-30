import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const COST_TYPES = ['material', 'labor', 'expense', 'purchase', 'manual'];

export function ConstructionPage() {
  const toast = useToast();
  const [boqs, setBoqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingId, setViewingId] = useState(null);

  function load() {
    setLoading(true);
    api.get('/construction/boqs').then(setBoqs).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="page-title">Bills of Quantities</p>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">A real, pre-approved estimate created before costs start accumulating, compared against actual project costs your team already logs, line by line.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New BOQ</button>
      </div>

      {loading && <Loading />}
      {!loading && boqs.length === 0 && <EmptyState title="No BOQs yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create one</button>} />}
      {!loading && boqs.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-sunken border-b border-rule">
                <th className="py-3 px-4 eyebrow font-medium">Title</th>
                <th className="py-3 px-4 eyebrow font-medium">Line items</th>
                <th className="py-3 px-4 eyebrow font-medium text-right">Estimated total</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {boqs.map((b) => (
                <tr key={b._id} className="hover:bg-paper transition-colors">
                  <td className="py-3 px-4 font-medium text-ink">{b.title}</td>
                  <td className="py-3 px-4 text-ink-muted">{b.lineItems.length}</td>
                  <td className="py-3 px-4 num text-right">{formatMoney(b.totalEstimated)}</td>
                  <td className="py-3 px-4 text-right">
                    <button className="btn-ghost !text-accent" onClick={() => setViewingId(b._id)}>Variance</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <BoqForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {viewingId && <VariancePanel boqId={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
}

function BoqForm({ onClose, onSaved }) {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState([{ description: '', unit: '', estimatedQuantity: '', estimatedRate: '', costType: 'material' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/projects').then(setProjects).catch(() => {}); }, []);

  function updateLine(i, patch) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/construction/boqs', {
        projectId, title,
        lineItems: lines.map((l) => ({ ...l, estimatedQuantity: Number(l.estimatedQuantity), estimatedRate: Number(l.estimatedRate) })),
      });
      toast('BOQ created.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-bold text-ink mb-4">New BOQ</p>
        <div className="space-y-3 mb-4">
          <select required className="field-input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Project…</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <input required className="field-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <p className="field-label mb-2">Line items</p>
        <div className="space-y-2 mb-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-6 gap-2">
              <input required className="field-input col-span-2" placeholder="Description" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
              <select className="field-input" value={l.costType} onChange={(e) => updateLine(i, { costType: e.target.value })}>
                {COST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" className="field-input num" placeholder="Qty" value={l.estimatedQuantity} onChange={(e) => updateLine(i, { estimatedQuantity: e.target.value })} />
              <input type="number" className="field-input num" placeholder="Rate" value={l.estimatedRate} onChange={(e) => updateLine(i, { estimatedRate: e.target.value })} />
              <input className="field-input" placeholder="Unit" value={l.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setLines([...lines, { description: '', unit: '', estimatedQuantity: '', estimatedRate: '', costType: 'material' }])}>
          + Add line
        </button>

        <div className="flex justify-end gap-2 pt-3 border-t border-rule">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create BOQ'}</button>
        </div>
      </form>
    </div>
  );
}

function VariancePanel({ boqId, onClose }) {
  const { company } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get(`/construction/boqs/${boqId}/variance`).then(setReport).catch((err) => toast(err.message, 'error'));
  }, [boqId]);

  if (!report) return null;

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg font-bold text-ink">Variance</p>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card bg-surface-sunken p-3">
            <p className="eyebrow">Estimated</p>
            <p className="font-display text-lg font-bold mt-1 num text-ink">{formatMoney(report.totalEstimated, company?.currency)}</p>
          </div>
          <div className="card bg-surface-sunken p-3">
            <p className="eyebrow">Actual</p>
            <p className="font-display text-lg font-bold mt-1 num text-ink">{formatMoney(report.totalActual, company?.currency)}</p>
          </div>
          <div className="card bg-surface-sunken p-3">
            <p className="eyebrow">Variance</p>
            <p className={`font-display text-lg font-bold mt-1 num ${report.totalVariance > 0 ? 'text-danger' : 'text-accent-strong'}`}>{formatMoney(report.totalVariance, company?.currency)}</p>
          </div>
        </div>
        <p className="text-xs text-ink-muted mb-3">Actual totals include every cost type the project has actually incurred, even a category nobody budgeted for at all, which is real, meaningful overage, not noise.</p>
        <div className="card overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-sunken border-b border-rule">
                <th className="py-2.5 px-3 eyebrow font-medium">Type</th>
                <th className="py-2.5 px-3 eyebrow font-medium text-right">Estimated</th>
                <th className="py-2.5 px-3 eyebrow font-medium text-right">Actual</th>
                <th className="py-2.5 px-3 eyebrow font-medium text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {report.byType.map((r) => (
                <tr key={r.costType} className="hover:bg-paper transition-colors">
                  <td className="py-2.5 px-3 capitalize text-ink">{r.costType}</td>
                  <td className="py-2.5 px-3 num text-right">{formatMoney(r.estimated, company?.currency)}</td>
                  <td className="py-2.5 px-3 num text-right">{formatMoney(r.actual, company?.currency)}</td>
                  <td className={`py-2.5 px-3 num text-right ${r.variance > 0 ? 'text-danger' : 'text-accent-strong'}`}>{formatMoney(r.variance, company?.currency)} {r.variancePercent !== null ? `(${r.variancePercent}%)` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
