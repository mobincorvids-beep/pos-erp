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
        <div className="flex gap-2">
          {[['work-orders', 'Work orders'], ['boms', 'Bills of materials']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'work-orders' && <WorkOrdersTab />}
      {tab === 'boms' && <BomsTab />}
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
      toast('Production started — raw materials consumed.', 'success');
      onChanged();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function complete() {
    setBusy(true);
    try {
      await api.post(`/manufacturing/work-orders/${workOrder._id}/complete`, { quantityProduced: Number(quantityProduced) });
      toast('Production completed — finished goods added to stock.', 'success');
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
          <p className="text-xs text-ink-muted mb-2">If less than planned, the shortfall (wastage) makes each finished unit cost more — the difference isn't silently absorbed.</p>
          <button className="btn-primary w-full" disabled={busy} onClick={complete}>
            {busy ? 'Completing…' : 'Complete production'}
          </button>
        </div>
      )}
      {workOrder.status === 'completed' && <p className="text-sm text-accent-strong">Completed — {formatQty(workOrder.quantityProduced)} units added to stock.</p>}
    </div>
  );
}

function WorkOrderForm({ onClose, onSaved }) {
  const toast = useToast();
  const [boms, setBoms] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ bomId: '', branchId: '', warehouseId: '', quantityToProduce: 1 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/manufacturing/boms').then(setBoms).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/manufacturing/work-orders', { ...form, quantityToProduce: Number(form.quantityToProduce) });
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
