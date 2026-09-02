import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatQty, formatMoney } from '../lib/format';

export function ManufacturingPage() {
  const [tab, setTab] = useState('work-orders');
  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="page-title mb-1">Production Control</p>
          <p className="text-ink-muted">Work orders, bills of materials &amp; production status</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {[
            ['work-orders', 'Work orders'],
            ['boms', 'Bills of materials'],
            ['work-centers', 'Work centers'],
            ['routings', 'Routings'],
            ['mrp', 'MRP'],
            ['schedule', 'Schedule'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'work-orders' && <WorkOrdersTab />}
      {tab === 'boms' && <BomsTab />}
      {tab === 'work-centers' && <WorkCentersTab />}
      {tab === 'routings' && <RoutingsTab />}
      {tab === 'mrp' && <MrpTab />}
      {tab === 'schedule' && <ScheduleTab />}
    </div>
  );
}

function WorkOrdersTab() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/manufacturing/work-orders').then(setOrders).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const activeCount = orders.filter((o) => o.status === 'in_progress').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="card p-5">
            <p className="eyebrow mb-3">Active orders</p>
            <p className="font-display text-3xl font-bold text-accent num">{activeCount}<span className="text-base font-normal text-ink-muted"> / {orders.length}</span></p>
          </div>
          <div className="card p-5">
            <p className="eyebrow mb-3">Completed</p>
            <p className="font-display text-3xl font-bold text-accent num">{completedCount}</p>
          </div>
          <div className="card p-5">
            <p className="eyebrow mb-3">Planned</p>
            <p className="font-display text-3xl font-bold text-accent num">{orders.filter((o) => o.status === 'planned').length}</p>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex justify-between items-center px-5 py-4 border-b border-rule">
            <p className="font-display text-lg font-semibold text-accent">Active Work Order Ledger</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>New work order</button>
          </div>
          {loading && <div className="p-5"><Loading /></div>}
          {!loading && orders.length === 0 && <div className="p-5"><EmptyState title="No work orders yet" description="Create a Bill of Materials first, then start a production run against it." /></div>}
          {!loading && orders.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                  <th className="px-5 py-3 font-semibold">Work order #</th>
                  <th className="px-5 py-3 font-semibold text-right">Planned qty</th>
                  <th className="px-5 py-3 font-semibold text-right">Produced</th>
                  <th className="px-5 py-3 font-semibold w-40">Progress</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((wo) => {
                  const pct = wo.quantityToProduce ? Math.min(100, Math.round((wo.quantityProduced / wo.quantityToProduce) * 100)) : 0;
                  const statusChip = wo.status === 'completed' ? 'chip-accent' : wo.status === 'in_progress' ? 'chip-info' : 'chip-neutral';
                  return (
                    <tr key={wo._id} onClick={() => setSelected(wo)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-surface-sunken/60 transition-colors ${selected?._id === wo._id ? 'bg-accent-soft/40' : ''}`}>
                      <td className="px-5 py-4 num font-semibold text-accent">{wo.workOrderNumber}</td>
                      <td className="px-5 py-4 num text-right">{formatQty(wo.quantityToProduce)}</td>
                      <td className="px-5 py-4 num text-right">{formatQty(wo.quantityProduced)}</td>
                      <td className="px-5 py-4">
                        <div className="w-full bg-surface-sunken rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full ${wo.status === 'completed' ? 'bg-accent' : 'bg-accent/70'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-4"><span className={statusChip}>{wo.status.replace('_', ' ')}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {selected && <WorkOrderPanel workOrder={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <WorkOrderForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function WorkOrderPanel({ workOrder, onClose, onChanged }) {
  const toast = useToast();
  const [quantityProduced, setQuantityProduced] = useState(workOrder.quantityToProduce);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      await api.post(`/manufacturing/work-orders/${workOrder._id}/start`);
      toast('Production started: raw materials consumed.', 'success');
      onChanged();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function complete() {
    setBusy(true);
    try {
      await api.post(`/manufacturing/work-orders/${workOrder._id}/complete`, { quantityProduced: Number(quantityProduced) });
      toast('Production completed: finished goods added to stock.', 'success');
      onChanged();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-80 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg font-semibold text-accent num">{workOrder.workOrderNumber}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>
      <p className="text-sm text-ink-muted mb-4">Planned: {formatQty(workOrder.quantityToProduce)} units</p>

      {workOrder.status === 'planned' && (
        <button className="btn-primary w-full" disabled={busy} onClick={start}>
          {busy ? 'Starting…' : 'Start production (consume materials)'}
        </button>
      )}
      {workOrder.status === 'in_progress' && (
        <div>
          <label className="field-label">Quantity actually produced</label>
          <input type="number" className="field-input num mb-2" value={quantityProduced} onChange={(e) => setQuantityProduced(e.target.value)} />
          <p className="text-xs text-ink-muted mb-2">If less than planned, the shortfall (wastage) makes each finished unit cost more, the difference isn't silently absorbed.</p>
          <button className="btn-primary w-full" disabled={busy} onClick={complete}>
            {busy ? 'Completing…' : 'Complete production'}
          </button>
        </div>
      )}
      {workOrder.status === 'completed' && <p className="text-sm text-accent-strong">Completed: {formatQty(workOrder.quantityProduced)} units added to stock.</p>}
    </div>
  );
}

function WorkOrderForm({ onClose, onSaved }) {
  const toast = useToast();
  const [boms, setBoms] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ bomId: '', branchId: '', warehouseId: '', routingId: '', quantityToProduce: 1 });
  const [routings, setRoutings] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/manufacturing/boms').then(setBoms).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);
  useEffect(() => {
    if (form.bomId) api.get(`/manufacturing/routings?bomId=${form.bomId}`).then(setRoutings).catch(() => {});
    else setRoutings([]);
  }, [form.bomId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/manufacturing/work-orders', { ...form, routingId: form.routingId || undefined, quantityToProduce: Number(form.quantityToProduce) });
      toast('Work order created.', 'success');
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
        <p className="font-display text-lg mb-4">New work order</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Bill of materials</label>
            <select required className="field-input" value={form.bomId} onChange={(e) => setForm({ ...form, bomId: e.target.value })}>
              <option value="">Select…</option>
              {boms.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          {routings.length > 0 && (
            <div>
              <label className="field-label">Routing (optional — enables scheduling)</label>
              <select className="field-input" value={form.routingId} onChange={(e) => setForm({ ...form, routingId: e.target.value })}>
                <option value="">No routing</option>
                {routings.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            </div>
          )}
          <div><label className="field-label">Quantity to produce</label><input type="number" min="1" required className="field-input num" value={form.quantityToProduce} onChange={(e) => setForm({ ...form, quantityToProduce: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

function BomsTab() {
  const toast = useToast();
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/manufacturing/boms').then(setBoms).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>New BOM</button>
      </div>
      {loading && <Loading />}
      {!loading && boms.length === 0 && <EmptyState title="No bills of materials yet" description="Define what raw materials go into one finished unit." />}
      {!loading && boms.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {boms.map((b) => (
            <div key={b._id} className="card p-5">
              <p className="font-display font-semibold text-accent">{b.name}</p>
              <p className="text-xs text-ink-muted mt-2">{b.components.length} component{b.components.length === 1 ? '' : 's'}</p>
              <p className="text-xs text-ink-muted mt-1">Labor {formatMoney(b.laborCostPerUnit)}/unit · Overhead {formatMoney(b.overheadCostPerUnit)}/unit</p>
            </div>
          ))}
        </div>
      )}
      {showForm && <BomForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function BomForm({ onClose, onSaved }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [finishedProductId, setFinishedProductId] = useState('');
  const [laborCostPerUnit, setLaborCostPerUnit] = useState('');
  const [overheadCostPerUnit, setOverheadCostPerUnit] = useState('');
  const [components, setComponents] = useState([{ productId: '', quantityPerUnit: 1 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  function updateComponent(i, patch) {
    setComponents((prev) => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const finishedProduct = products.find((p) => p._id === finishedProductId);
      await api.post('/manufacturing/boms', {
        name, finishedProductId, finishedVariantId: finishedProduct?.variants?.[0]?._id,
        laborCostPerUnit: Number(laborCostPerUnit) || 0, overheadCostPerUnit: Number(overheadCostPerUnit) || 0,
        components: components.filter((c) => c.productId).map((c) => {
          const p = products.find((pr) => pr._id === c.productId);
          return { productId: c.productId, variantId: p?.variants?.[0]?._id, quantityPerUnit: Number(c.quantityPerUnit) };
        }),
      });
      toast('BOM created.', 'success');
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
        <p className="font-display text-lg mb-4">New bill of materials</p>
        <div className="space-y-3 mb-4">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Recipe" /></div>
          <div>
            <label className="field-label">Finished product</label>
            <select required className="field-input" value={finishedProductId} onChange={(e) => setFinishedProductId(e.target.value)}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Labor cost/unit</label><input type="number" className="field-input num" value={laborCostPerUnit} onChange={(e) => setLaborCostPerUnit(e.target.value)} /></div>
            <div><label className="field-label">Overhead/unit</label><input type="number" className="field-input num" value={overheadCostPerUnit} onChange={(e) => setOverheadCostPerUnit(e.target.value)} /></div>
          </div>
        </div>

        <p className="field-label mb-1">Components (raw materials per finished unit)</p>
        <div className="space-y-2 mb-2">
          {components.map((c, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <select className="field-input col-span-2" value={c.productId} onChange={(e) => updateComponent(i, { productId: e.target.value })}>
                <option value="">Product…</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" step="0.01" className="field-input num" value={c.quantityPerUnit} onChange={(e) => updateComponent(i, { quantityPerUnit: e.target.value })} placeholder="Qty" />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setComponents([...components, { productId: '', quantityPerUnit: 1 }])}>
          + Add component
        </button>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save BOM'}</button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Work Centers
// ---------------------------------------------------------------------------

function WorkCentersTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    api.get('/manufacturing/work-centers').then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>New work center</button>
      </div>
      {loading && <Loading />}
      {!loading && rows.length === 0 && <EmptyState title="No work centers yet" description="Add the machines, lines, or labor groups production runs against." />}
      {!loading && rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Description</th>
                <th className="px-5 py-3 font-semibold text-right">Capacity (hrs/day)</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((wc) => (
                <tr key={wc._id} className="border-b border-rule last:border-0">
                  <td className="px-5 py-3 font-semibold text-accent">{wc.name}</td>
                  <td className="px-5 py-3 text-ink-muted">{wc.description || '—'}</td>
                  <td className="px-5 py-3 num text-right">{formatQty(wc.capacityHoursPerDay)}</td>
                  <td className="px-5 py-3"><span className={wc.isActive ? 'chip-accent' : 'chip-neutral'}>{wc.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-5 py-3 text-right"><button className="btn-ghost !px-0 text-xs" onClick={() => { setEditing(wc); setShowForm(true); }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <WorkCenterForm workCenter={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function WorkCenterForm({ workCenter, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(workCenter?.name || '');
  const [description, setDescription] = useState(workCenter?.description || '');
  const [capacityHoursPerDay, setCapacityHoursPerDay] = useState(workCenter?.capacityHoursPerDay ?? 8);
  const [isActive, setIsActive] = useState(workCenter?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, description, capacityHoursPerDay: Number(capacityHoursPerDay), isActive };
      if (workCenter) await api.put(`/manufacturing/work-centers/${workCenter._id}`, payload);
      else await api.post('/manufacturing/work-centers', payload);
      toast(workCenter ? 'Work center updated.' : 'Work center created.', 'success');
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
        <p className="font-display text-lg mb-4">{workCenter ? 'Edit work center' : 'New work center'}</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CNC Line 1" /></div>
          <div><label className="field-label">Description</label><input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><label className="field-label">Capacity (hours/day)</label><input type="number" min="0.1" step="0.5" required className="field-input num" value={capacityHoursPerDay} onChange={(e) => setCapacityHoursPerDay(e.target.value)} /></div>
          {workCenter && (
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
            </label>
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

// ---------------------------------------------------------------------------
// Routings
// ---------------------------------------------------------------------------

function RoutingsTab() {
  const toast = useToast();
  const [routings, setRoutings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/manufacturing/routings').then(setRoutings).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>New routing</button>
      </div>
      {loading && <Loading />}
      {!loading && routings.length === 0 && <EmptyState title="No routings yet" description="Attach an ordered list of operations to a BOM so its work orders can be scheduled against real work-center capacity." />}
      {!loading && routings.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {routings.map((r) => (
            <div key={r._id} className="card p-5">
              <p className="font-display font-semibold text-accent">{r.name}</p>
              <ol className="mt-2 space-y-1">
                {[...r.operations].sort((a, b) => a.sequence - b.sequence).map((op) => (
                  <li key={op._id} className="text-xs text-ink-muted flex justify-between">
                    <span>{op.sequence}. {op.operationName}</span>
                    <span className="num">{formatQty(op.estimatedHours)}h</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      {showForm && <RoutingForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function RoutingForm({ onClose, onSaved }) {
  const toast = useToast();
  const [boms, setBoms] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [bomId, setBomId] = useState('');
  const [name, setName] = useState('');
  const [operations, setOperations] = useState([{ sequence: 1, workCenterId: '', operationName: '', estimatedHours: 1 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/manufacturing/boms').then(setBoms).catch(() => {});
    api.get('/manufacturing/work-centers').then(setWorkCenters).catch(() => {});
  }, []);

  function updateOp(i, patch) {
    setOperations((prev) => prev.map((o, idx) => idx === i ? { ...o, ...patch } : o));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/manufacturing/routings', {
        bomId, name,
        operations: operations.map((o) => ({ ...o, sequence: Number(o.sequence), estimatedHours: Number(o.estimatedHours) })),
      });
      toast('Routing created.', 'success');
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
        <p className="font-display text-lg mb-4">New routing</p>
        <div className="space-y-3 mb-4">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard routing" /></div>
          <div>
            <label className="field-label">Bill of materials</label>
            <select required className="field-input" value={bomId} onChange={(e) => setBomId(e.target.value)}>
              <option value="">Select…</option>
              {boms.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        <p className="field-label mb-1">Operations, in order</p>
        <div className="space-y-2 mb-2">
          {operations.map((o, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 items-center">
              <input type="number" min="1" className="field-input num col-span-1" value={o.sequence} onChange={(e) => updateOp(i, { sequence: e.target.value })} title="Sequence" />
              <input className="field-input col-span-2" placeholder="Operation" value={o.operationName} onChange={(e) => updateOp(i, { operationName: e.target.value })} />
              <select className="field-input col-span-2" value={o.workCenterId} onChange={(e) => updateOp(i, { workCenterId: e.target.value })}>
                <option value="">Work center…</option>
                {workCenters.map((wc) => <option key={wc._id} value={wc._id}>{wc.name}</option>)}
              </select>
              <input type="number" step="0.25" min="0.25" className="field-input num col-span-1" placeholder="Hrs" value={o.estimatedHours} onChange={(e) => updateOp(i, { estimatedHours: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4"
          onClick={() => setOperations([...operations, { sequence: operations.length + 1, workCenterId: '', operationName: '', estimatedHours: 1 }])}>
          + Add operation
        </button>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save routing'}</button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MRP
// ---------------------------------------------------------------------------

function MrpTab() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [demandLines, setDemandLines] = useState([{ productId: '', quantity: 1 }]);
  const [includeReorderLevel, setIncludeReorderLevel] = useState(false);
  const [run, setRun] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
  }, []);
  useEffect(() => { if (branchId) api.get(`/org/warehouses?branchId=${branchId}`).then(setWarehouses).catch(() => {}); }, [branchId]);

  function updateLine(i, patch) {
    setDemandLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  async function handleRun() {
    setRunning(true);
    try {
      const demand = demandLines.filter((l) => l.productId).map((l) => {
        const p = products.find((pr) => pr._id === l.productId);
        return { productId: l.productId, variantId: p?.variants?.[0]?._id, quantity: Number(l.quantity) };
      });
      const result = await api.post('/manufacturing/mrp-runs', { branchId, warehouseId, demand, includeReorderLevel });
      setRun(result);
      toast('MRP run computed.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-96 shrink-0 card p-5 h-fit">
        <p className="font-display text-lg font-semibold text-accent mb-3">Run MRP</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" checked={includeReorderLevel} onChange={(e) => setIncludeReorderLevel(e.target.checked)} />
            Also plan for products at/below reorder level
          </label>

          <p className="field-label mb-1">Target quantities (optional)</p>
          <div className="space-y-2">
            {demandLines.map((l, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <select className="field-input col-span-2" value={l.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                  <option value="">Product…</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
                <input type="number" min="1" className="field-input num" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost !px-0 text-xs" onClick={() => setDemandLines([...demandLines, { productId: '', quantity: 1 }])}>
            + Add target
          </button>

          <button className="btn-primary w-full mt-2" disabled={running || !warehouseId} onClick={handleRun}>
            {running ? 'Running…' : 'Run MRP'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {!run && <EmptyState title="No MRP run yet" description="Set targets (or auto-plan from reorder levels) and run MRP to see the exploded shortage list." />}
        {run && <MrpResult run={run} branchId={branchId} warehouseId={warehouseId} onConverted={setRun} />}
      </div>
    </div>
  );
}

function MrpResult({ run, branchId, warehouseId, onConverted }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [supplierByLine, setSupplierByLine] = useState({});
  const [busyLine, setBusyLine] = useState(null);

  useEffect(() => { api.get('/suppliers').then(setSuppliers).catch(() => {}); }, []);

  async function refresh() {
    const fresh = await api.get(`/manufacturing/mrp-runs/${run._id}`);
    onConverted(fresh);
  }

  async function convertPurchase(line) {
    const supplierId = supplierByLine[line._id];
    if (!supplierId) { toast('Choose a supplier first.', 'error'); return; }
    setBusyLine(line._id);
    try {
      await api.post(`/manufacturing/mrp-runs/${run._id}/suggested-purchases/${line._id}/convert`, { supplierId, branchId, warehouseId });
      toast('Draft purchase order created.', 'success');
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyLine(null);
    }
  }

  async function convertWorkOrder(line) {
    setBusyLine(line._id);
    try {
      await api.post(`/manufacturing/mrp-runs/${run._id}/suggested-work-orders/${line._id}/convert`, { branchId, warehouseId });
      toast('Draft work order created.', 'success');
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyLine(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <p className="font-display text-lg font-semibold text-accent px-5 py-4 border-b border-rule">Suggested purchases (raw materials)</p>
        {run.suggestedPurchases.length === 0 && <p className="text-sm text-ink-muted p-5">Nothing short — on-hand stock covers demand.</p>}
        {run.suggestedPurchases.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                <th className="px-5 py-3 font-semibold">Required</th>
                <th className="px-5 py-3 font-semibold text-right">On hand</th>
                <th className="px-5 py-3 font-semibold text-right">Shortfall</th>
                <th className="px-5 py-3 font-semibold">Supplier</th>
                <th className="px-5 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {run.suggestedPurchases.map((line) => (
                <tr key={line._id} className="border-b border-rule last:border-0">
                  <td className="px-5 py-3 num">{formatQty(line.requiredQuantity)}</td>
                  <td className="px-5 py-3 num text-right">{formatQty(line.onHandQuantity)}</td>
                  <td className="px-5 py-3 num text-right font-semibold text-danger">{formatQty(line.shortfallQuantity)}</td>
                  <td className="px-5 py-3">
                    {line.status === 'converted' ? <span className="chip-accent">PO raised</span> : (
                      <select className="field-input" value={supplierByLine[line._id] || ''} onChange={(e) => setSupplierByLine({ ...supplierByLine, [line._id]: e.target.value })}>
                        <option value="">Select…</option>
                        {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {line.status !== 'converted' && (
                      <button className="btn-secondary text-xs" disabled={busyLine === line._id} onClick={() => convertPurchase(line)}>
                        {busyLine === line._id ? 'Creating…' : 'Convert to PO'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <p className="font-display text-lg font-semibold text-accent px-5 py-4 border-b border-rule">Suggested work orders (sub-assemblies)</p>
        {run.suggestedWorkOrders.length === 0 && <p className="text-sm text-ink-muted p-5">No sub-assembly shortages.</p>}
        {run.suggestedWorkOrders.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                <th className="px-5 py-3 font-semibold text-right">Quantity needed</th>
                <th className="px-5 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {run.suggestedWorkOrders.map((line) => (
                <tr key={line._id} className="border-b border-rule last:border-0">
                  <td className="px-5 py-3 num text-right">{formatQty(line.requiredQuantity)}</td>
                  <td className="px-5 py-3 text-right">
                    {line.status === 'converted' ? <span className="chip-accent">WO raised</span> : (
                      <button className="btn-secondary text-xs" disabled={busyLine === line._id} onClick={() => convertWorkOrder(line)}>
                        {busyLine === line._id ? 'Creating…' : 'Convert to work order'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule — a simple list grouped by work center and date, not a full Gantt.
// ---------------------------------------------------------------------------

function ScheduleTab() {
  const toast = useToast();
  const [workOrders, setWorkOrders] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/manufacturing/work-orders?status=in_progress'),
      api.get('/manufacturing/work-centers'),
    ]).then(([orders, centers]) => { setWorkOrders(orders); setWorkCenters(centers); }).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  const workCenterNames = Object.fromEntries(workCenters.map((wc) => [wc._id, wc.name]));

  const groups = {};
  for (const wo of workOrders) {
    for (const op of wo.schedule || []) {
      const dayKey = new Date(op.scheduledStart).toISOString().slice(0, 10);
      const key = `${op.workCenterId}|${dayKey}`;
      if (!groups[key]) groups[key] = { workCenterId: op.workCenterId, day: dayKey, ops: [] };
      groups[key].ops.push({ ...op, workOrderNumber: wo.workOrderNumber });
    }
  }
  const sortedGroups = Object.values(groups).sort((a, b) => (a.day + a.workCenterId).localeCompare(b.day + b.workCenterId));

  if (loading) return <Loading />;
  if (sortedGroups.length === 0) return <EmptyState title="Nothing scheduled" description="Start a work order that has a routing to schedule its operations against work-center capacity." />;

  return (
    <div className="space-y-4">
      {sortedGroups.map((g) => (
        <div key={`${g.workCenterId}|${g.day}`} className="card overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-rule bg-surface-sunken">
            <p className="font-display font-semibold text-accent">{workCenterNames[g.workCenterId] || 'Work center'}</p>
            <p className="text-xs text-ink-muted num">{g.day}</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {g.ops.sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart)).map((op) => (
                <tr key={op._id} className="border-b border-rule last:border-0">
                  <td className="px-5 py-3 num font-semibold text-accent">{op.workOrderNumber}</td>
                  <td className="px-5 py-3">{op.operationName}</td>
                  <td className="px-5 py-3 num text-ink-muted">
                    {new Date(op.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(op.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3"><span className={op.status === 'completed' ? 'chip-accent' : 'chip-info'}>{op.status.replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
