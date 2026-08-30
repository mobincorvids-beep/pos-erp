import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

const STATUSES = ['booked', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'];

const ALLOWED_TRANSITIONS = {
  booked: ['picked_up', 'failed'],
  picked_up: ['in_transit', 'failed'],
  in_transit: ['out_for_delivery', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  failed: ['in_transit', 'returned'],
  delivered: [],
  returned: [],
};

function statusLabel(status) {
  return status.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function statusChipClass(status) {
  if (status === 'delivered') return 'chip-accent';
  if (status === 'failed' || status === 'returned') return 'chip-danger';
  if (status === 'booked') return 'chip-neutral';
  return 'chip-info';
}

function generateTrackingNumber() {
  return `TRK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
}

export function CourierPage() {
  const [tab, setTab] = useState('shipments');
  return (
    <div>
      <p className="page-title mb-4">Courier</p>
      <div className="flex gap-2 mb-5">
        {[['shipments', 'Shipments'], ['track', 'Track a package']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'shipments' && <ShipmentsTab />}
      {tab === 'track' && <TrackTab />}
    </div>
  );
}

function TrackTab() {
  const toast = useToast();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!trackingNumber.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const shipment = await api.get(`/courier/shipments/track/${encodeURIComponent(trackingNumber.trim())}`);
      setResult(shipment);
    } catch (err) {
      setResult(null);
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="card p-4 flex gap-2 max-w-lg">
        <input
          className="field-input"
          placeholder="Enter tracking number…"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={loading} className="btn-primary shrink-0">{loading ? 'Searching…' : 'Track'}</button>
      </form>

      {loading && <div className="mt-4"><Loading /></div>}
      {!loading && searched && !result && (
        <div className="mt-4"><EmptyState title="No shipment found" description="Check the tracking number and try again." /></div>
      )}
      {!loading && result && (
        <div className="card p-4 mt-4 max-w-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="font-display text-lg num">{result.trackingNumber}</p>
            <span className={statusChipClass(result.status)}>{statusLabel(result.status)}</span>
          </div>
          {(result.origin || result.destination) && (
            <p className="text-sm text-ink-muted mb-3">{result.origin || '-'} → {result.destination || '-'}</p>
          )}
          <p className="field-label mb-2">History</p>
          <div className="space-y-2">
            {(result.history || []).slice().reverse().map((ev, i) => (
              <div key={i} className="text-sm flex items-start gap-2">
                <span className={`${statusChipClass(ev.status)} shrink-0`}>{statusLabel(ev.status)}</span>
                <div>
                  <p className="text-ink-muted">{ev.location || ''}{ev.note ? (ev.location ? ' · ' : '') + ev.note : ''}</p>
                  <p className="text-xs text-ink-muted">{ev.at ? new Date(ev.at).toLocaleString() : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ShipmentsTab() {
  const toast = useToast();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [delivering, setDelivering] = useState(null);

  function load() {
    setLoading(true);
    const query = statusFilter ? `?status=${statusFilter}` : '';
    api.get(`/courier/shipments${query}`).then(setShipments).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  async function advance(shipment, status) {
    try {
      await api.post(`/courier/shipments/${shipment._id}/advance`, { status });
      toast(`Shipment moved to "${statusLabel(status)}".`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <select className="field-input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New shipment</button>
      </div>

      {loading && <Loading />}
      {!loading && shipments.length === 0 && (
        <EmptyState title="No shipments yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Book a shipment</button>} />
      )}
      {!loading && shipments.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left">
                <th className="eyebrow px-4 py-3 font-semibold">Tracking No.</th>
                <th className="eyebrow px-4 py-3 font-semibold">Customer</th>
                <th className="eyebrow px-4 py-3 font-semibold">Destination</th>
                <th className="eyebrow px-4 py-3 font-semibold">Status</th>
                <th className="eyebrow px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => {
                const nextOptions = ALLOWED_TRANSITIONS[s.status] || [];
                const canDeliver = s.status === 'out_for_delivery';
                return (
                  <tr key={s._id} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-3 num font-medium">{s.trackingNumber}</td>
                    <td className="px-4 py-3 text-ink-muted">{s.customerId?.name || 'Customer'}</td>
                    <td className="px-4 py-3 text-ink-muted">{s.destination || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={statusChipClass(s.status)}>{statusLabel(s.status)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {nextOptions.length > 0 && (
                          <select
                            className="field-input !w-auto text-xs !py-1"
                            value=""
                            onChange={(e) => { if (e.target.value) advance(s, e.target.value); }}
                          >
                            <option value="">Advance status…</option>
                            {nextOptions.map((opt) => <option key={opt} value={opt}>{statusLabel(opt)}</option>)}
                          </select>
                        )}
                        {canDeliver && (
                          <button className="btn-ghost !px-2 text-xs" onClick={() => setDelivering(s)}>Mark delivered</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ShipmentForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {delivering && <DeliverForm shipment={delivering} onClose={() => setDelivering(null)} onSaved={() => { setDelivering(null); load(); }} />}
    </div>
  );
}

function ShipmentForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    branchId: '', customerId: '', trackingNumber: generateTrackingNumber(),
    origin: '', destination: '', weight: '', codAmount: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/courier/shipments', {
        ...form,
        weight: form.weight === '' ? undefined : Number(form.weight),
        codAmount: form.codAmount === '' ? 0 : Number(form.codAmount),
      });
      toast('Shipment booked.', 'success');
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
        <p className="font-display text-lg mb-4">New shipment</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Tracking number</label>
            <div className="flex gap-2">
              <input required className="field-input num" value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} />
              <button type="button" className="btn-secondary shrink-0" onClick={() => setForm({ ...form, trackingNumber: generateTrackingNumber() })}>Generate</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Origin</label><input className="field-input" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} /></div>
            <div><label className="field-label">Destination</label><input className="field-input" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Weight (kg)</label><input type="number" className="field-input num" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></div>
            <div><label className="field-label">COD amount</label><input type="number" className="field-input num" value={form.codAmount} onChange={(e) => setForm({ ...form, codAmount: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Booking…' : 'Book shipment'}</button>
        </div>
      </form>
    </div>
  );
}

function DeliverForm({ shipment, onClose, onSaved }) {
  const toast = useToast();
  const [proofOfDeliveryNote, setProofOfDeliveryNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/courier/shipments/${shipment._id}/deliver`, { proofOfDeliveryNote });
      toast('Shipment marked delivered.', 'success');
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
        <p className="font-display text-lg mb-1">Mark delivered</p>
        <p className="text-sm text-ink-muted num mb-4">{shipment.trackingNumber}</p>
        <div>
          <label className="field-label">Proof of delivery note (who signed, etc.)</label>
          <input className="field-input" autoFocus value={proofOfDeliveryNote} onChange={(e) => setProofOfDeliveryNote(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Confirm delivery'}</button>
        </div>
      </form>
    </div>
  );
}
