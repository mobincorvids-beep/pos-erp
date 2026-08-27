import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDateTime } from '../lib/format';

// CORE cross-industry shipment tracking page — distinct from the
// industry-module src/modules/logistics client page (which already owns
// the /logistics path and is about fleet trip costing, not generic
// outbound-delivery tracking). Named CoreLogisticsPage / mounted at
// /logistics-core to avoid colliding with that existing page and route.
const STATUSES = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'];

const STATUS_LABEL = {
  pending: 'Pending',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  failed: 'Failed',
  returned: 'Returned',
};

const STATUS_CHIP = {
  pending: 'chip-neutral',
  picked_up: 'chip-info',
  in_transit: 'chip-warning',
  out_for_delivery: 'chip-warning',
  delivered: 'chip-accent',
  failed: 'chip-danger',
  returned: 'chip-danger',
};

function StatusChip({ status }) {
  return (
    <span className={`${STATUS_CHIP[status] || 'chip-neutral'} gap-1.5`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function CoreLogisticsPage() {
  const toast = useToast();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  function load() {
    setLoading(true);
    const query = statusFilter ? `?status=${statusFilter}` : '';
    api.get(`/logistics${query}`).then(setShipments).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <p className="page-title">Shipments</p>
          <p className="text-sm text-ink-muted mt-1">Track outbound deliveries from pickup through proof of delivery.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          New shipment
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button className={statusFilter === '' ? 'pill-active' : 'pill'} onClick={() => setStatusFilter('')}>All</button>
        {STATUSES.map((s) => (
          <button key={s} className={statusFilter === s ? 'pill-active' : 'pill'} onClick={() => setStatusFilter(s)}>{STATUS_LABEL[s]}</button>
        ))}
      </div>

      {loading && <Loading />}
      {!loading && shipments.length === 0 && (
        <EmptyState title="No shipments yet" description="Create a shipment from a sale or standalone to start tracking deliveries." action={<button className="btn-primary" onClick={() => setShowCreate(true)}>New shipment</button>} />
      )}
      {!loading && shipments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">Shipment Ledger</p>
            <span className="eyebrow">{shipments.length} shipments</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">Shipment</th>
                  <th className="py-3 px-5 eyebrow font-medium">Carrier / Tracking</th>
                  <th className="py-3 px-5 eyebrow font-medium">Destination</th>
                  <th className="py-3 px-5 eyebrow font-medium">Status</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">Cost</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {shipments.map((s) => (
                  <tr key={s._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-sunken flex items-center justify-center text-ink-muted shrink-0">
                          <span className="material-symbols-outlined">local_shipping</span>
                        </div>
                        <p className="text-sm font-semibold text-ink num">{s.shipmentNumber}</p>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-sm text-ink-muted">
                      <div>{s.carrierName || '—'}</div>
                      <div className="text-xs num">{s.trackingNumber || '—'}</div>
                    </td>
                    <td className="py-3 px-5 text-sm text-ink">{s.destination?.city || '—'}</td>
                    <td className="py-3 px-5"><StatusChip status={s.status} /></td>
                    <td className="py-3 px-5 text-sm text-ink font-semibold text-right num">{formatMoney(s.shippingCost || 0)}</td>
                    <td className="py-3 px-5 text-right">
                      <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setSelectedId(s._id)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreateShipmentModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {selectedId && <ShipmentDetail id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
    </div>
  );
}

function CreateShipmentModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    saleId: '', customerId: '', carrierName: '', trackingNumber: '',
    destinationCity: '', destinationLine1: '', shippingCost: '',
  });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/logistics', {
        saleId: form.saleId || null,
        customerId: form.customerId || null,
        carrierName: form.carrierName,
        trackingNumber: form.trackingNumber,
        destination: { city: form.destinationCity, line1: form.destinationLine1 },
        shippingCost: form.shippingCost ? Number(form.shippingCost) : 0,
      });
      toast('Shipment created', 'success');
      onCreated();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4" onClick={onClose}>
      <form onSubmit={submit} className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg mb-4">New shipment</p>
        <div className="space-y-3">
          <input className="field-input" placeholder="Sale ID (optional — leave blank for standalone)" value={form.saleId} onChange={(e) => setForm({ ...form, saleId: e.target.value })} />
          <input className="field-input" placeholder="Customer ID (optional)" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} />
          <input className="field-input" placeholder="Carrier name" value={form.carrierName} onChange={(e) => setForm({ ...form, carrierName: e.target.value })} />
          <input className="field-input" placeholder="Tracking number" value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} />
          <input className="field-input" placeholder="Destination address line" value={form.destinationLine1} onChange={(e) => setForm({ ...form, destinationLine1: e.target.value })} />
          <input className="field-input" placeholder="Destination city" value={form.destinationCity} onChange={(e) => setForm({ ...form, destinationCity: e.target.value })} />
          <div>
            <label className="field-label">Shipping cost</label>
            <input className="field-input num" type="number" step="0.01" value={form.shippingCost} onChange={(e) => setForm({ ...form, shippingCost: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

function ShipmentDetail({ id, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [nextStatus, setNextStatus] = useState('');

  function load() {
    setLoading(true);
    api.get(`/logistics/${id}`).then(setData).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  async function updateStatus() {
    if (!nextStatus) return;
    try {
      await api.post(`/logistics/${id}/status`, { status: nextStatus, note });
      toast('Status updated', 'success');
      setNote('');
      setNextStatus('');
      load();
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function markDelivered() {
    const podNote = prompt('Proof of delivery note (optional):') || '';
    try {
      await api.post(`/logistics/${id}/deliver`, { podNote });
      toast('Marked delivered', 'success');
      load();
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">Shipment detail</p>
          <button className="text-ink-muted hover:text-ink" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {(loading || !data) ? <Loading /> : (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-ink num">{data.shipment.shipmentNumber}</p>
                <p className="text-xs text-ink-muted mt-1">Tracking: <span className="num">{data.shipment.trackingNumber || '—'}</span> · Carrier: {data.shipment.carrierName || '—'}</p>
                <p className="text-xs text-ink-muted">Destination: {data.shipment.destination?.line1} {data.shipment.destination?.city}</p>
              </div>
              <StatusChip status={data.shipment.status} />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <select className="field-input w-auto" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                <option value="">Update status…</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <input className="field-input flex-1 min-w-[120px]" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-secondary" onClick={updateStatus}>Apply</button>
            </div>

            {data.shipment.status !== 'delivered' && (
              <button className="btn-primary w-full" onClick={markDelivered}>Mark delivered (record POD)</button>
            )}

            <div>
              <p className="eyebrow mb-3">Timeline</p>
              <ul className="space-y-3">
                {data.timeline.map((ev) => (
                  <li key={ev._id} className="text-sm border-l-2 border-accent/40 pl-3">
                    <div className="text-ink font-medium">{STATUS_LABEL[ev.status] || ev.status} {ev.location ? `— ${ev.location}` : ''}</div>
                    {ev.note && <div className="text-ink-muted">{ev.note}</div>}
                    <div className="text-xs text-ink-muted mt-0.5">{formatDateTime(ev.createdAt)}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
