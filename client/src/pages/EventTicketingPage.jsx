import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function EventTicketingPage() {
  const toast = useToast();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    api.get('/media-entertainment/shows').then(setShows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Shows</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New show</button>
      </div>
      <p className="text-sm text-ink-muted mb-5 max-w-2xl">Each tier — VIP, Standard, Balcony — has its own independent capacity and its own waitlist. A sold-out VIP tier never offers a Standard seat instead; they're genuinely different products.</p>

      {loading && <Loading />}
      {!loading && shows.length === 0 && (
        <EmptyState title="No shows yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Schedule one</button>} />
      )}
      {!loading && shows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Tiers</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {shows.map((s) => (
                <tr key={s._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{s.eventName}</td>
                  <td className="px-3 py-2 text-ink-muted">{new Date(s.showDateTime).toLocaleString()}</td>
                  <td className="px-3 py-2 text-ink-muted">{s.tiers.length}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="btn-ghost !text-accent" onClick={() => setSelected(s)}>Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ShowForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {selected && <ShowManager show={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function ShowForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [eventName, setEventName] = useState('');
  const [showDateTime, setShowDateTime] = useState('');
  const [tiers, setTiers] = useState([{ name: '', capacity: '', price: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  function updateTier(i, patch) {
    setTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/media-entertainment/shows', {
        branchId, eventName, showDateTime,
        tiers: tiers.map((t) => ({ name: t.name, capacity: Number(t.capacity), price: Number(t.price) })),
      });
      toast('Show scheduled.', 'success');
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
        <p className="font-display text-lg mb-4">New show</p>
        <div className="space-y-3 mb-3">
          <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <input required className="field-input" placeholder="Event name" value={eventName} onChange={(e) => setEventName(e.target.value)} />
          <input required type="datetime-local" className="field-input" value={showDateTime} onChange={(e) => setShowDateTime(e.target.value)} />
        </div>

        <p className="field-label mb-1">Seating tiers</p>
        <div className="space-y-2 mb-2">
          {tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <input required className="field-input" placeholder="Tier name" value={t.name} onChange={(e) => updateTier(i, { name: e.target.value })} />
              <input required type="number" min="1" className="field-input num" placeholder="Capacity" value={t.capacity} onChange={(e) => updateTier(i, { capacity: e.target.value })} />
              <input required type="number" step="0.01" className="field-input num" placeholder="Price" value={t.price} onChange={(e) => updateTier(i, { price: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setTiers([...tiers, { name: '', capacity: '', price: '' }])}>
          + Add tier
        </button>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Scheduling…' : 'Schedule show'}</button>
        </div>
      </form>
    </div>
  );
}

function ShowManager({ show, onClose, onChanged }) {
  const { company } = useAuth();
  const toast = useToast();
  const [roster, setRoster] = useState(null);
  const [bookingTierId, setBookingTierId] = useState(null);

  function load() {
    api.get(`/media-entertainment/shows/${show._id}/roster`).then(setRoster).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [show._id]);

  if (!roster) return null;

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{roster.eventName}</p>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>

        <div className="space-y-4">
          {roster.tiers.map((tier) => {
            const sold = tier.soldCustomerIds.length;
            const remaining = tier.capacity - sold;
            return (
              <div key={tier._id} className="card p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">{tier.name} — {formatMoney(tier.price, company?.currency)}</p>
                  <span className={remaining > 0 ? 'chip-accent' : 'chip-danger'}>{remaining > 0 ? `${remaining} of ${tier.capacity} left` : 'Sold out'}</span>
                </div>
                {tier.waitlistCustomerIds.length > 0 && (
                  <p className="text-xs text-ink-muted mb-2">{tier.waitlistCustomerIds.length} on the waitlist for this tier specifically.</p>
                )}
                {show.status === 'scheduled' && (
                  <button className="btn-secondary text-xs" onClick={() => setBookingTierId(tier._id)}>
                    {remaining > 0 ? 'Sell a ticket' : 'Add to waitlist'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {bookingTierId && <TicketForm show={show} tierId={bookingTierId} onClose={() => setBookingTierId(null)} onBooked={() => { setBookingTierId(null); load(); onChanged(); }} />}
      </div>
    </div>
  );
}

function TicketForm({ show, tierId, onClose, onBooked }) {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ customerId: '', warehouseId: '', ticketBillingProductId: '', paymentAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
    if (show.branchId) api.get(`/org/warehouses?branchId=${show.branchId}`).then(setWarehouses).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.ticketBillingProductId);
      if (!product) throw new Error('Select a billing product — it must have trackingMode "service".');
      const result = await api.post(`/media-entertainment/shows/${show._id}/tiers/${tierId}/book`, { ...form, ticketBillingVariantId: product.variants[0]?._id });
      toast(result.waitlisted ? `Tier is full — added to the waitlist at position ${result.waitlistPosition}.` : 'Ticket sold.', 'success');
      onBooked();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center z-50 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Sell a ticket</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Billing product (trackingMode "service")</label>
            <select required className="field-input" value={form.ticketBillingProductId} onChange={(e) => setForm({ ...form, ticketBillingProductId: e.target.value })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse (for the Sale document)</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Payment account</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Processing…' : 'Confirm'}</button>
        </div>
      </form>
    </div>
  );
}
