import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const LEASE_CHIP = { active: 'chip-accent', ended: 'chip-neutral' };
const PROPERTY_CHIP = { available: 'chip-accent', leased: 'chip-warning' };

export function RealEstatePage() {
  const [tab, setTab] = useState('leases');
  return (
    <div>
      <p className="page-title mb-1">Real Estate</p>
      <p className="text-sm text-ink-muted mb-5">Portfolio leases and property inventory.</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['leases', 'Leases'], ['properties', 'Properties']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'leases' ? <LeasesTab /> : <PropertiesTab />}
    </div>
  );
}

function LeasesTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/real-estate/leases').then(setLeases).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <span className="material-symbols-outlined text-base leading-none">add</span> Start a lease
          </button>
        </div>
        {loading && <Loading />}
        {!loading && leases.length === 0 && <EmptyState title="No leases yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Start one</button>} />}
        {!loading && leases.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                  <th className="px-3 py-2.5 font-semibold">Property</th>
                  <th className="px-3 py-2.5 font-semibold">Tenant</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Rent</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {leases.map((l) => (
                  <tr key={l._id} onClick={() => setSelected(l)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper transition-colors ${selected?._id === l._id ? 'bg-accent-soft/50' : ''}`}>
                    <td className="px-3 py-2.5 font-medium text-ink">{l.propertyId?.unitNumber || '-'}</td>
                    <td className="px-3 py-2.5">{l.tenantCustomerId?.name || '-'}</td>
                    <td className="px-3 py-2.5 num text-right">{formatMoney(l.monthlyRent, company?.currency)}</td>
                    <td className="px-3 py-2.5"><span className={LEASE_CHIP[l.status]}>{l.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <LeasePanel lease={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <LeaseForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function LeaseForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [properties, setProperties] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', propertyId: '', tenantCustomerId: '', startDate: '', endDate: '', monthlyRent: '', lateFeePerDay: '', securityDeposit: '', depositReceivedAccountId: '', securityDepositLiabilityAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/real-estate/properties?status=available').then(setProperties).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, monthlyRent: Number(form.monthlyRent), lateFeePerDay: form.lateFeePerDay ? Number(form.lateFeePerDay) : undefined };
      if (form.securityDeposit) {
        payload.securityDeposit = Number(form.securityDeposit);
        if (!form.depositReceivedAccountId || !form.securityDepositLiabilityAccountId) {
          throw new Error('Both the receiving account and the liability account are required when taking a security deposit.');
        }
      } else {
        delete payload.securityDeposit; delete payload.depositReceivedAccountId; delete payload.securityDepositLiabilityAccountId;
      }
      await api.post('/real-estate/leases', payload);
      toast('Lease started.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-bold text-ink mb-4">Start a lease</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select required className="field-input" value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
            <option value="">Available property…</option>
            {properties.map((p) => <option key={p._id} value={p._id}>{p.unitNumber}: {p.propertyType}</option>)}
          </select>
          <select required className="field-input" value={form.tenantCustomerId} onChange={(e) => setForm({ ...form, tenantCustomerId: e.target.value })}>
            <option value="">Tenant…</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" required className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <input type="date" required className="field-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" required className="field-input num" placeholder="Monthly rent" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} />
            <input type="number" className="field-input num" placeholder="Late fee/day" value={form.lateFeePerDay} onChange={(e) => setForm({ ...form, lateFeePerDay: e.target.value })} />
          </div>

          <div className="tear-line" />
          <p className="text-xs text-ink-muted">Optional security deposit: posts as a liability until the lease ends.</p>
          <input type="number" className="field-input num" placeholder="Security deposit (leave blank for none)" value={form.securityDeposit} onChange={(e) => setForm({ ...form, securityDeposit: e.target.value })} />
          {form.securityDeposit && (
            <div className="grid grid-cols-2 gap-2">
              <select className="field-input" value={form.depositReceivedAccountId} onChange={(e) => setForm({ ...form, depositReceivedAccountId: e.target.value })}>
                <option value="">Received into…</option>
                {accounts.filter((a) => a.isPaymentAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
              <select className="field-input" value={form.securityDepositLiabilityAccountId} onChange={(e) => setForm({ ...form, securityDepositLiabilityAccountId: e.target.value })}>
                <option value="">Liability account…</option>
                {accounts.filter((a) => a.type === 'liability').map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Starting…' : 'Start lease'}</button>
        </div>
      </form>
    </div>
  );
}

function LeasePanel({ lease, onClose, onChanged }) {
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [billingProductId, setBillingProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [showEndForm, setShowEndForm] = useState(false);
  const [deductionAmount, setDeductionAmount] = useState('');
  const [refundAccountId, setRefundAccountId] = useState('');
  const [forfeitRevenueAccountId, setForfeitRevenueAccountId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
    if (lease.branchId) api.get(`/org/warehouses?branchId=${lease.branchId}`).then(setWarehouses).catch(() => {});
    if (lease.securityDeposit > 0) api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, [lease._id]);

  async function generateRent() {
    setBusy(true);
    try {
      const product = products.find((p) => p._id === billingProductId);
      if (!product) { toast('Select a billing product.', 'error'); setBusy(false); return; }
      const result = await api.post(`/real-estate/leases/${lease._id}/generate-rent`, { billingProductId, billingVariantId: product.variants[0]?._id, warehouseId });
      toast(`Billed ${formatMoney(result.sale.totalAmount, company?.currency)}${result.lateFee > 0 ? ` (includes ${formatMoney(result.lateFee, company?.currency)} late fee)` : ''}.`, 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function endLease(e) {
    e?.preventDefault();
    setBusy(true);
    try {
      const body = lease.securityDeposit > 0 ? { deductionAmount: deductionAmount ? Number(deductionAmount) : 0, refundAccountId: refundAccountId || undefined, forfeitRevenueAccountId: forfeitRevenueAccountId || undefined } : {};
      const result = await api.post(`/real-estate/leases/${lease._id}/end`, body);
      toast(result.refund > 0 ? `Lease ended: ${formatMoney(result.refund, company?.currency)} deposit refunded.` : 'Lease ended.', 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg font-bold text-ink">{lease.propertyId?.unitNumber}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>
      <p className="text-sm text-ink-muted mb-4">{lease.tenantCustomerId?.name}: <span className="num">{formatMoney(lease.monthlyRent, company?.currency)}</span>/month</p>
      {lease.securityDeposit > 0 && (
        <div className="chip-info mb-4 !inline-flex">Security deposit held: <span className="num ml-1">{formatMoney(lease.securityDeposit, company?.currency)}</span></div>
      )}

      {lease.status === 'active' && !showEndForm && (
        <>
          <p className="eyebrow mb-2">Generate rent invoice</p>
          <div className="space-y-2 mb-2">
            <select className="field-input" value={billingProductId} onChange={(e) => setBillingProductId(e.target.value)}>
              <option value="">Billing product…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            <select className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Warehouse…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <button className="btn-primary w-full mb-3" disabled={!billingProductId || !warehouseId || busy} onClick={generateRent}>
            {busy ? 'Generating…' : 'Generate rent'}
          </button>
          <button className="btn-secondary w-full" disabled={busy} onClick={() => lease.securityDeposit > 0 ? setShowEndForm(true) : endLease()}>End lease</button>
        </>
      )}

      {lease.status === 'active' && showEndForm && (
        <form onSubmit={endLease} className="space-y-2">
          <p className="text-sm text-ink-muted">A security deposit is on file, decide how much to refund versus keep for damage.</p>
          <div>
            <label className="field-label">Deduction for damage (0 = full refund)</label>
            <input type="number" min="0" max={lease.securityDeposit} className="field-input num" value={deductionAmount} onChange={(e) => setDeductionAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="field-label">Refund from account</label>
            <select required className="field-input" value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.filter((a) => a.isPaymentAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          {Number(deductionAmount) > 0 && (
            <div>
              <label className="field-label">Forfeited revenue account</label>
              <select required className="field-input" value={forfeitRevenueAccountId} onChange={(e) => setForfeitRevenueAccountId(e.target.value)}>
                <option value="">Select…</option>
                {accounts.filter((a) => a.type === 'income').map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowEndForm(false)}>Back</button>
            <button type="submit" disabled={busy} className="btn-danger flex-1">{busy ? 'Ending…' : 'Confirm end'}</button>
          </div>
        </form>
      )}

      {lease.status === 'ended' && <p className="text-sm text-ink-muted">Lease ended.</p>}
    </div>
  );
}

function PropertiesTab() {
  const toast = useToast();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/real-estate/properties').then(setProperties).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-base leading-none">add</span> Add property
        </button>
      </div>
      {loading && <Loading />}
      {!loading && properties.length === 0 && <EmptyState title="No properties yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add one</button>} />}
      {!loading && properties.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {properties.map((p) => (
            <div key={p._id} className="card p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-ink">{p.unitNumber}</p>
                <span className={PROPERTY_CHIP[p.status]}>{p.status}</span>
              </div>
              <p className="text-xs text-ink-muted">{p.propertyType}</p>
            </div>
          ))}
        </div>
      )}
      {showForm && <PropertyForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function PropertyForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', unitNumber: '', propertyType: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/real-estate/properties', form);
      toast('Property added.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">Add property</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <input required className="field-input" placeholder="Unit number" value={form.unitNumber} onChange={(e) => setForm({ ...form, unitNumber: e.target.value })} />
          <input required className="field-input" placeholder="Property type" value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
