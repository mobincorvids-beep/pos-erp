import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const STATUS_CHIP = { scheduled: 'chip-neutral', en_route: 'chip-info', in_progress: 'chip-warning', completed: 'chip-accent', cancelled: 'chip-danger' };
const NEXT_STATUS = { scheduled: ['en_route', 'cancelled'], en_route: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [] };

export function FieldServicePage() {
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (technicianFilter) params.set('assignedTechnicianId', technicianFilter);
    api.get(`/field-service?${params.toString()}`).then(setJobs).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter, technicianFilter]);
  useEffect(() => { api.get('/users').then(setUsers).catch(() => {}); }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow mb-1">Field service</p>
            <p className="page-title">Dispatch &amp; job board</p>
            <p className="text-sm text-ink-muted mt-1">Track technicians, checklists, parts, and on-site billing.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>New dispatch</button>
        </div>

        <div className="flex gap-2">
          <select className="field-input !w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="en_route">En route</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="field-input !w-48" value={technicianFilter} onChange={(e) => setTechnicianFilter(e.target.value)}>
            <option value="">All technicians</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>

        {loading && <Loading />}
        {!loading && jobs.length === 0 && (
          <EmptyState title="No field service jobs yet" description="Dispatch a technician to a customer's site — track the job, parts, labor, and billing." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Dispatch a technician</button>} />
        )}
        {!loading && jobs.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-rule bg-surface-sunken/60">
                    <th className="px-5 py-3 eyebrow font-medium">Site</th>
                    <th className="px-5 py-3 eyebrow font-medium">Scheduled</th>
                    <th className="px-5 py-3 eyebrow font-medium">Status</th>
                    <th className="px-5 py-3 eyebrow font-medium text-right">Labor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {jobs.map((j) => (
                    <tr key={j._id} onClick={() => setSelected(j)} className={`group cursor-pointer transition-colors hover:bg-accent-soft/30 ${selected?._id === j._id ? 'bg-accent-soft/40' : ''}`}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-ink group-hover:text-accent transition-colors">{j.siteAddress}</p>
                        {j.jobType && <p className="text-xs text-ink-muted mt-0.5">{j.jobType}</p>}
                      </td>
                      <td className="px-5 py-4 text-xs text-ink-muted">{new Date(j.scheduledAt).toLocaleString()}</td>
                      <td className="px-5 py-4"><span className={STATUS_CHIP[j.status]}>{j.status.replace('_', ' ')}</span></td>
                      <td className="px-5 py-4 num text-right text-ink-muted">{formatMoney(j.laborCharge)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {selected && <JobPanel job={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <JobForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function JobForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    customerId: '', siteAddress: '', branchId: '', warehouseId: '',
    assignedTechnicianId: '', scheduledAt: '', jobType: '', description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/users').then(setUsers).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/field-service', { ...form, assignedTechnicianId: form.assignedTechnicianId || undefined });
      toast('Technician dispatched.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">New dispatch</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Site address</label><input required autoFocus className="field-input" value={form.siteAddress} onChange={(e) => setForm({ ...form, siteAddress: e.target.value })} placeholder="Customer's site address" /></div>
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse (for parts)</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Assign technician</label>
            <select className="field-input" value={form.assignedTechnicianId} onChange={(e) => setForm({ ...form, assignedTechnicianId: e.target.value })}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Scheduled time</label><input required type="datetime-local" className="field-input" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
          <div><label className="field-label">Job type</label><input className="field-input" value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })} placeholder="e.g. HVAC repair" /></div>
          <div><label className="field-label">Description</label><input className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Dispatching…' : 'Dispatch'}</button>
        </div>
      </form>
    </div>
  );
}

function JobPanel({ job, onClose, onChanged }) {
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [partProductId, setPartProductId] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [laborCharge, setLaborCharge] = useState(job.laborCharge || '');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState(false);
  const [laborProductId, setLaborProductId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [customerSignatureName, setCustomerSignatureName] = useState(job.customerSignatureName || '');

  useEffect(() => {
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function updateStatus(status) {
    try {
      await api.patch(`/field-service/${job._id}/status`, { status });
      toast('Status updated.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function toggleChecklistItem(index) {
    const checklist = job.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c));
    try {
      await api.patch(`/field-service/${job._id}/checklist`, { checklist });
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function addChecklistItem() {
    if (!newChecklistItem.trim()) return;
    const checklist = [...(job.checklist || []), { item: newChecklistItem.trim(), done: false }];
    try {
      await api.patch(`/field-service/${job._id}/checklist`, { checklist });
      setNewChecklistItem('');
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function addPart() {
    const product = products.find((p) => p._id === partProductId);
    if (!product) return;
    setBusy(true);
    try {
      await api.post(`/field-service/${job._id}/parts`, {
        productId: product._id, variantId: product.variants[0]?._id,
        quantity: Number(partQty), unitPrice: product.sellingPrice,
      });
      toast('Part added and drawn from inventory.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function saveLabor() {
    try {
      await api.patch(`/field-service/${job._id}/labor-charge`, { laborCharge: Number(laborCharge) || 0 });
      toast('Labor charge saved.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function billJob() {
    setBilling(true);
    try {
      await api.post(`/field-service/${job._id}/bill`, {
        laborProductId: Number(job.laborCharge) > 0 ? laborProductId : undefined,
        laborVariantId: Number(job.laborCharge) > 0 ? products.find((p) => p._id === laborProductId)?.variants[0]?._id : undefined,
        paymentAccountId: paymentAccountId || undefined,
        customerSignatureName: customerSignatureName || undefined,
      });
      toast('Job billed.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBilling(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4 h-fit">
      <div className="card overflow-hidden">
        <div className="bg-surface-sunken/60 px-5 py-4 border-b border-rule flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-ink truncate pr-2">{job.siteAddress}</p>
          <button className="text-ink-muted hover:text-ink text-sm shrink-0" onClick={onClose}>Close</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="field-label">Status</label>
            <select className="field-input" value={job.status} onChange={(e) => updateStatus(e.target.value)}>
              <option value="scheduled" disabled={!NEXT_STATUS[job.status]?.includes('scheduled') && job.status !== 'scheduled'}>Scheduled</option>
              <option value="en_route" disabled={!NEXT_STATUS[job.status]?.includes('en_route') && job.status !== 'en_route'}>En route</option>
              <option value="in_progress" disabled={!NEXT_STATUS[job.status]?.includes('in_progress') && job.status !== 'in_progress'}>In progress</option>
              <option value="completed" disabled={!NEXT_STATUS[job.status]?.includes('completed') && job.status !== 'completed'}>Completed</option>
              <option value="cancelled" disabled={!NEXT_STATUS[job.status]?.includes('cancelled') && job.status !== 'cancelled'}>Cancelled</option>
            </select>
          </div>

          <div>
            <p className="field-label mb-2">Checklist</p>
            <div className="space-y-1.5 text-sm mb-2">
              {(!job.checklist || job.checklist.length === 0) && <p className="text-ink-muted text-xs">No checklist items.</p>}
              {job.checklist?.map((c, i) => (
                <label key={i} className="flex items-center gap-2">
                  <input type="checkbox" checked={c.done} onChange={() => toggleChecklistItem(i)} />
                  <span className={c.done ? 'line-through text-ink-muted' : 'text-ink'}>{c.item}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="field-input" placeholder="Add checklist item" value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} />
              <button className="btn-secondary shrink-0" onClick={addChecklistItem}>Add</button>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-surface-sunken border border-rule relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
            <p className="field-label mb-2">Parts used</p>
            <div className="space-y-1 text-sm">
              {job.partsUsed?.length === 0 && <p className="text-ink-muted text-xs">None yet.</p>}
              {job.partsUsed?.map((p, i) => (
                <div key={i} className="flex justify-between"><span className="text-ink-muted">× {p.quantity}</span><span className="num text-ink">{formatMoney(p.unitPrice * p.quantity, company?.currency)}</span></div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select className="field-input col-span-2" value={partProductId} onChange={(e) => setPartProductId(e.target.value)}>
              <option value="">Add a part…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            <input type="number" min="1" className="field-input num" value={partQty} onChange={(e) => setPartQty(e.target.value)} />
          </div>
          <button className="btn-secondary w-full" disabled={!partProductId || busy} onClick={addPart}>Add part</button>

          <div>
            <label className="field-label">Labor charge</label>
            <div className="flex gap-2">
              <input type="number" className="field-input num" value={laborCharge} onChange={(e) => setLaborCharge(e.target.value)} />
              <button className="btn-secondary shrink-0" onClick={saveLabor}>Save</button>
            </div>
          </div>

          {job.status === 'completed' && !job.saleId && (
            <div className="border-t border-rule pt-4">
              <p className="field-label mb-2">Bill this job</p>
              <div className="space-y-2 mb-3">
                {Number(job.laborCharge) > 0 && (
                  <select className="field-input" value={laborProductId} onChange={(e) => setLaborProductId(e.target.value)}>
                    <option value="">Labor service product…</option>
                    {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                )}
                <select className="field-input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                  <option value="">Payment account (leave blank if on credit)…</option>
                  {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
                <input className="field-input" placeholder="Customer signed off by (optional)" value={customerSignatureName} onChange={(e) => setCustomerSignatureName(e.target.value)} />
              </div>
              <button className="btn-primary w-full" disabled={billing} onClick={billJob}>{billing ? 'Billing…' : 'Bill job'}</button>
            </div>
          )}
          {job.saleId && <p className="text-xs text-ink-muted pt-2 border-t border-rule">Billed — invoice created.</p>}
        </div>
      </div>
    </div>
  );
}
