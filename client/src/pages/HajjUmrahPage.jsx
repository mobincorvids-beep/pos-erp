import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { open: 'chip-accent', full: 'chip-warning', departed: 'chip-neutral', cancelled: 'chip-danger' };

export function HajjUmrahPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [enrolling, setEnrolling] = useState(null);

  function load() {
    setLoading(true);
    api.get('/hajj-umrah/groups').then(setGroups).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Pilgrimage groups</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New group</button>
      </div>

      {loading && <Loading />}
      {!loading && groups.length === 0 && <EmptyState title="No groups yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create one</button>} />}
      {!loading && groups.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Package</th>
                <th className="px-3 py-2 font-medium">Departure</th>
                <th className="px-3 py-2 font-medium">Enrolled</th>
                <th className="px-3 py-2 font-medium text-right">Price</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{g.packageName}</td>
                  <td className="px-3 py-2 text-ink-muted">{formatDate(g.departureDate)}</td>
                  <td className="px-3 py-2 text-ink-muted">{g.enrolledCustomerIds.length}/{g.capacity} {g.waitlistCustomerIds.length > 0 && `(+${g.waitlistCustomerIds.length} waitlist)`}</td>
                  <td className="px-3 py-2 num text-right">{formatMoney(g.packagePrice, company?.currency)}</td>
                  <td className="px-3 py-2"><span className={STATUS_CHIP[g.status]}>{g.status}</span></td>
                  <td className="px-3 py-2 text-right">
                    {g.status === 'open' && <button className="btn-ghost !text-accent" onClick={() => setEnrolling(g)}>Enroll</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <GroupForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {enrolling && <EnrollForm group={enrolling} onClose={() => setEnrolling(null)} onSaved={() => { setEnrolling(null); load(); }} />}
    </div>
  );
}

function GroupForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', packageName: '', departureDate: '', capacity: '', packagePrice: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/hajj-umrah/groups', { ...form, capacity: Number(form.capacity), packagePrice: Number(form.packagePrice) });
      toast('Group created.', 'success');
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
        <p className="font-display text-lg mb-4">New group</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <input required className="field-input" placeholder="Package name" value={form.packageName} onChange={(e) => setForm({ ...form, packageName: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" required className="field-input" value={form.departureDate} onChange={(e) => setForm({ ...form, departureDate: e.target.value })} />
            <input type="number" required className="field-input num" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <input type="number" required className="field-input num" placeholder="Package price" value={form.packagePrice} onChange={(e) => setForm({ ...form, packagePrice: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

function EnrollForm({ group, onClose, onSaved }) {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [depositLiabilityAccountId, setDepositLiabilityAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts').then((rows) => setAccounts(rows.filter((a) => a.type === 'liability'))).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post(`/hajj-umrah/groups/${group._id}/enroll`, { customerId, depositLiabilityAccountId });
      toast(result.waitlisted ? `Group is full — added to the waitlist at position ${result.waitlistPosition}.` : 'Enrolled.', 'success');
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
        <p className="font-display text-lg mb-1">Enroll — {group.packageName}</p>
        <p className="text-sm text-ink-muted mb-4">{group.enrolledCustomerIds.length}/{group.capacity} enrolled</p>
        <div className="space-y-3">
          <select required className="field-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Customer…</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select required className="field-input" value={depositLiabilityAccountId} onChange={(e) => setDepositLiabilityAccountId(e.target.value)}>
            <option value="">Deposit liability account…</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Enrolling…' : 'Enroll'}</button>
        </div>
      </form>
    </div>
  );
}
