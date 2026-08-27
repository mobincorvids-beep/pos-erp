import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function SalesWorkflowPage() {
  const [tab, setTab] = useState('quotations');
  const [showForm, setShowForm] = useState(false);
  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="page-title">Quotations &amp; orders</p>
          <p className="text-sm text-ink-muted mt-1.5">Manage active quotes, track conversions, and monitor order fulfillment.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New {tab === 'quotations' ? 'quotation' : 'sales order'}</button>
      </div>
      <div className="flex gap-2 mb-5">
        {[['quotations', 'Quotations'], ['sales-orders', 'Sales orders']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'quotations' && <DocumentList key="quotations" kind="quotations" showForm={showForm} onCloseForm={() => setShowForm(false)} />}
      {tab === 'sales-orders' && <DocumentList key="sales-orders" kind="sales-orders" showForm={showForm} onCloseForm={() => setShowForm(false)} />}
    </div>
  );
}

const STATUS_CHIP = {
  quotation: 'chip-info',
  sales_order: 'chip-accent',
  cancelled: 'chip-danger',
  invoiced: 'chip-accent',
};

function statusChipClass(status) {
  return STATUS_CHIP[status] || 'chip-neutral';
}

function DocumentList({ kind, showForm, onCloseForm }) {
  const { company } = useAuth();
  const toast = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  function load() {
    setLoading(true);
    api.get(`/sales-workflow/${kind}`).then((data) => {
      setDocs(data);
      setSelectedId((prev) => (data.some((d) => d._id === prev) ? prev : data[0]?._id ?? null));
    }).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [kind]);

  async function accept(id) {
    try {
      await api.post(`/sales-workflow/quotations/${id}/accept`);
      toast('Quotation accepted — now a sales order.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function cancel(id) {
    try {
      await api.post(`/sales-workflow/${id}/cancel`);
      toast('Cancelled.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  const selected = docs.find((d) => d._id === selectedId) || null;

  return (
    <>
      {showForm && (
        <NewDocumentModal
          kind={kind}
          onClose={onCloseForm}
          onCreated={() => { onCloseForm(); load(); }}
        />
      )}
      {loading ? <Loading /> : docs.length === 0 ? (
        <EmptyState title={`No ${kind === 'quotations' ? 'quotations' : 'sales orders'} yet`} description="These don't touch stock or the ledger until converted to an invoice." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Ledger panel */}
          <div className="lg:col-span-8 card overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-surface-sunken/40">
              <p className="font-display text-lg font-semibold text-accent">Active {kind === 'quotations' ? 'quotations' : 'sales orders'}</p>
              <span className="chip-accent">{docs.length} active</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-wide border-b border-rule">
                    <th className="px-6 py-3 font-semibold">Doc ref</th>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr
                      key={d._id}
                      onClick={() => setSelectedId(d._id)}
                      className={`border-b border-rule last:border-0 cursor-pointer transition-colors hover:bg-accent-soft/40 ${selectedId === d._id ? 'bg-accent-soft/60' : ''}`}
                    >
                      <td className="px-6 py-3 num text-accent-strong">{d.documentNumber}</td>
                      <td className="px-6 py-3 text-ink-muted">{formatDate(d.createdAt)}</td>
                      <td className="px-6 py-3"><span className={statusChipClass(d.status)}>{d.status.replace('_', ' ')}</span></td>
                      <td className="px-6 py-3 num text-right">{formatMoney(d.totalAmount, company?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-muted px-6 py-3 border-t border-rule mt-auto">
              Converting a sales order to an invoice (checkout) isn't yet wired into this UI — use <code className="num">POST /sales-workflow/:id/convert-to-invoice</code> directly for now.
            </p>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-4 space-y-5">
            {selected ? (
              <div className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-display text-lg font-semibold text-accent">{selected.documentNumber}</p>
                    <p className="text-sm text-ink-muted">{formatDate(selected.createdAt)}</p>
                  </div>
                  <span className={statusChipClass(selected.status)}>{selected.status.replace('_', ' ')}</span>
                </div>

                <div className="flex items-center justify-between bg-surface-sunken rounded-lg px-4 py-3 mb-4">
                  <span className="eyebrow text-accent-strong">Total ({company?.currency || 'amount'})</span>
                  <span className="font-display text-xl font-bold text-accent num">{formatMoney(selected.totalAmount, company?.currency)}</span>
                </div>

                <div className="flex gap-2">
                  {kind === 'quotations' && selected.status === 'quotation' && (
                    <button className="btn-primary flex-1" onClick={() => accept(selected._id)}>Accept</button>
                  )}
                  {(selected.status === 'quotation' || selected.status === 'sales_order') && (
                    <button className="btn-secondary flex-1 !text-danger" onClick={() => cancel(selected._id)}>Cancel</button>
                  )}
                </div>
              </div>
            ) : null}

            {/* Lifecycle tracker */}
            {selected && (
              <div className="card p-5">
                <p className="font-display text-base font-semibold text-accent mb-5">Lifecycle tracker</p>
                <div className="relative pl-7 space-y-6 before:absolute before:inset-y-0 before:left-[9px] before:w-px before:bg-rule">
                  <LifecycleStep label={`${kind === 'quotations' ? 'Quotation' : 'Sales order'} created`} detail={formatDate(selected.createdAt)} done />
                  {kind === 'quotations' && (
                    <LifecycleStep
                      label="Accepted → sales order"
                      detail={selected.status === 'quotation' ? 'Awaiting acceptance' : 'Converted'}
                      done={selected.status !== 'quotation'}
                      active={selected.status === 'quotation'}
                    />
                  )}
                  <LifecycleStep
                    label="Converted to invoice"
                    detail={selected.status === 'invoiced' ? 'Invoiced' : 'Not yet converted'}
                    done={selected.status === 'invoiced'}
                    active={selected.status === 'sales_order'}
                  />
                  <LifecycleStep
                    label="Cancelled"
                    detail={selected.status === 'cancelled' ? 'Cancelled' : '—'}
                    done={selected.status === 'cancelled'}
                    muted={selected.status !== 'cancelled'}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function LifecycleStep({ label, detail, done, active, muted }) {
  return (
    <div className={`relative ${muted && !done ? 'opacity-50' : ''}`}>
      <div className={`absolute -left-7 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
        done ? 'bg-accent' : active ? 'bg-surface border-2 border-accent' : 'bg-surface-sunken border-2 border-rule-strong'
      }`}>
        {done && <span className="text-white text-[10px] leading-none">✓</span>}
        {!done && active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
      </div>
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="text-xs text-ink-muted mt-0.5">{detail}</p>
    </div>
  );
}

// Same branch/warehouse/product-lines pattern used by CrmPage's "Win
// opportunity" modal, which already POSTs to the same underlying
// quotation-creation path — kept consistent rather than inventing a
// second UI convention for the same kind of document.
function NewDocumentModal({ kind, onClose, onCreated }) {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState([{ productId: '', quantity: 1, unitPrice: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/customers'), api.get('/org/branches'), api.get('/org/warehouses'), api.get('/products')])
      .then(([c, b, w, p]) => {
        setCustomers(c); setBranches(b); setWarehouses(w); setProducts(p);
        if (b.length) setBranchId(b[0]._id);
        if (w.length) setWarehouseId(w[0]._id);
      })
      .catch((err) => toast(err.message, 'error'));
  }, []);

  function updateLine(i, patch) { setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function addLine() { setLines([...lines, { productId: '', quantity: 1, unitPrice: '' }]); }
  function removeLine(i) { setLines(lines.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!warehouseId) return toast('Choose a warehouse.', 'error');
    if (kind === 'sales-orders' && !branchId) return toast('Choose a branch.', 'error');
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => {
        const product = products.find((p) => p._id === l.productId);
        const variant = product?.variants?.[0];
        return {
          productId: l.productId, variantId: variant?._id,
          quantity: Number(l.quantity),
          unitPrice: l.unitPrice !== '' ? Number(l.unitPrice) : (variant?.sellingPrice || 0),
        };
      })
      .filter((l) => l.variantId);
    if (items.length === 0) return toast('Add at least one product line.', 'error');

    setSaving(true);
    try {
      const path = kind === 'quotations' ? '/sales-workflow/quotations' : '/sales-workflow/sales-orders';
      await api.post(path, { branchId: branchId || undefined, warehouseId, customerId: customerId || undefined, items });
      toast(kind === 'quotations' ? 'Quotation created.' : 'Sales order created.', 'success');
      onCreated();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg">
        <p className="font-display text-lg mb-4">New {kind === 'quotations' ? 'quotation' : 'sales order'}</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="field-label">Customer (optional)</label>
            <select className="field-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select...</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
        </div>
        {kind === 'sales-orders' && (
          <div className="mb-3">
            <label className="field-label">Branch</label>
            <select className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select...</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <label className="field-label">Items</label>
        <div className="space-y-2 mb-3">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <select className="field-input flex-1" value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                <option value="">Select product...</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input w-20" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
              <input type="number" min="0" className="field-input w-28" placeholder="Unit price" value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} />
              {lines.length > 1 && <button className="btn-ghost !text-danger" onClick={() => removeLine(i)}>&times;</button>}
            </div>
          ))}
        </div>
        <button className="btn-ghost !text-accent mb-4" onClick={addLine}>+ Add another item</button>

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}
