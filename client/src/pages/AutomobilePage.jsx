import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function AutomobilePage() {
  return (
    <div>
      <p className="page-title mb-4">Automobile</p>
      <TradeInsTab />
    </div>
  );
}

function TradeInsTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [applying, setApplying] = useState(null);

  function load() {
    setLoading(true);
    api.get('/automobile/trade-ins').then(setCredits).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>New trade-in</button>
      </div>
      {loading && <Loading />}
      {!loading && credits.length === 0 && (
        <EmptyState title="No trade-ins yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add a trade-in</button>} />
      )}
      {!loading && credits.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Vehicle</th>
                <th className="px-3 py-2 font-medium">Appraised value</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => (
                <tr key={c._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{c.customerId?.name || '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{c.vehicleDescription || '—'}</td>
                  <td className="px-3 py-2 num">{formatMoney(c.appraisedValue, company?.currency)}</td>
                  <td className="px-3 py-2"><span className={c.status === 'applied' ? 'chip-accent' : c.status === 'cancelled' ? 'chip-warning' : 'chip-warning'}>{c.status}</span></td>
                  <td className="px-3 py-2 text-right">
                    {c.status === 'pending' && (
                      <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setApplying(c)}>Apply to sale</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <TradeInForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {applying && <ApplyForm credit={applying} onClose={() => setApplying(null)} onApplied={() => { setApplying(null); load(); }} />}
    </div>
  );
}

function TradeInForm({ onClose, onSaved }) {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customerId: '', vehicleDescription: '', appraisedValue: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/automobile/trade-ins', {
        customerId: form.customerId,
        vehicleDescription: form.vehicleDescription,
        appraisedValue: Number(form.appraisedValue),
      });
      toast('Trade-in recorded.', 'success');
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
        <p className="font-display text-lg mb-4">New trade-in</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Vehicle description</label>
            <input className="field-input" autoFocus value={form.vehicleDescription} onChange={(e) => setForm({ ...form, vehicleDescription: e.target.value })} placeholder="e.g. 2018 Honda Civic, VIN ..." />
          </div>
          <div>
            <label className="field-label">Appraised value</label>
            <input type="number" required min="0" step="0.01" className="field-input num" value={form.appraisedValue} onChange={(e) => setForm({ ...form, appraisedValue: e.target.value })} />
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

function ApplyForm({ credit, onClose, onApplied }) {
  const { company } = useAuth();
  const toast = useToast();
  const [saleId, setSaleId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/automobile/trade-ins/${credit._id}/apply`, { saleId });
      toast('Trade-in credit applied to sale.', 'success');
      onApplied();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-1">Apply trade-in credit</p>
        <p className="text-sm text-ink-muted mb-4 num">{formatMoney(credit.appraisedValue, company?.currency)} — {credit.customerId?.name}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Sale ID</label>
            <input required autoFocus className="field-input" value={saleId} onChange={(e) => setSaleId(e.target.value)} placeholder="Sale _id to apply this credit to" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Applying…' : 'Apply'}</button>
        </div>
      </form>
    </div>
  );
}
