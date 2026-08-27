import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const CLAIM_CHIP = { submitted: 'chip-warning', paid: 'chip-accent', rejected: 'chip-danger' };

export function InsurancePage() {
  const [tab, setTab] = useState('policies');
  return (
    <div>
      <div className="mb-5">
        <p className="page-title">Insurance &amp; Underwriting</p>
        <p className="text-sm text-ink-muted mt-1">Policies, claims, and underwriting decisions.</p>
      </div>
      <div className="flex gap-2 mb-5">
        {[['policies', 'Policies'], ['claims', 'Claims']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'policies' ? <PoliciesTab /> : <ClaimsTab />}
    </div>
  );
}

function PoliciesTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [claiming, setClaiming] = useState(null);

  function load() {
    setLoading(true);
    api.get('/insurance/policies').then(setPolicies).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>Sell a policy</button>
      </div>
      {loading && <Loading />}
      {!loading && policies.length === 0 && <EmptyState title="No policies yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Sell one</button>} />}
      {!loading && policies.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left">
                <th className="px-3 py-2.5 eyebrow font-medium">Customer</th>
                <th className="px-3 py-2.5 eyebrow font-medium">Type</th>
                <th className="px-3 py-2.5 eyebrow font-medium text-right">Coverage</th>
                <th className="px-3 py-2.5 eyebrow font-medium text-right">Premium</th>
                <th className="px-3 py-2.5 eyebrow font-medium">Period</th>
                <th className="px-3 py-2.5 eyebrow font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/50">
                  <td className="px-3 py-2.5">{p.customerId?.name || '—'}</td>
                  <td className="px-3 py-2.5 text-ink-muted">{p.policyType}</td>
                  <td className="px-3 py-2.5 num text-right">{formatMoney(p.coverageAmount, company?.currency)}</td>
                  <td className="px-3 py-2.5 num text-right">{formatMoney(p.premiumAmount, company?.currency)}</td>
                  <td className="px-3 py-2.5 text-ink-muted">{formatDate(p.startDate)} – {formatDate(p.endDate)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="btn-ghost !text-accent" onClick={() => setClaiming(p)}>File a claim</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <PolicyForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {claiming && <ClaimForm policy={claiming} onClose={() => setClaiming(null)} onSaved={() => setClaiming(null)} />}
    </div>
  );
}

function PolicyForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', customerId: '', policyType: '', coverageAmount: '', premiumAmount: '', startDate: '', endDate: '', billingProductId: '', warehouseId: '', paymentAccountId: '' });
  const [warehouses, setWarehouses] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.billingProductId);
      if (!product) throw new Error('Select a billing product — it must have trackingMode "service".');
      await api.post('/insurance/policies', { ...form, coverageAmount: Number(form.coverageAmount), premiumAmount: Number(form.premiumAmount), billingVariantId: product.variants[0]?._id });
      toast('Policy sold.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">Sell a policy</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, warehouseId: '' })}>
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
          <div><label className="field-label">Policy type</label><input required className="field-input" value={form.policyType} onChange={(e) => setForm({ ...form, policyType: e.target.value })} placeholder="Motor, health, property…" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Coverage</label><input type="number" required className="field-input num" value={form.coverageAmount} onChange={(e) => setForm({ ...form, coverageAmount: e.target.value })} /></div>
            <div><label className="field-label">Premium</label><input type="number" required className="field-input num" value={form.premiumAmount} onChange={(e) => setForm({ ...form, premiumAmount: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Start</label><input type="date" required className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="field-label">End</label><input type="date" required className="field-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">Billing product (trackingMode "service")</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse (for the Sale document)</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Premium received into</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Selling…' : 'Sell policy'}</button>
        </div>
      </form>
    </div>
  );
}

function ClaimForm({ policy, onClose, onSaved }) {
  const { company } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ claimAmount: '', description: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/insurance/policies/${policy._id}/claims`, { ...form, claimAmount: Number(form.claimAmount) });
      toast('Claim submitted.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-1">File a claim</p>
        <p className="text-sm text-ink-muted mb-4">Coverage ceiling: {formatMoney(policy.coverageAmount, company?.currency)}</p>
        <div className="space-y-3">
          <div><label className="field-label">Claim amount</label><input type="number" required max={policy.coverageAmount} className="field-input num" value={form.claimAmount} onChange={(e) => setForm({ ...form, claimAmount: e.target.value })} /></div>
          <div><label className="field-label">Description</label><textarea required rows={3} className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Submitting…' : 'Submit claim'}</button>
        </div>
      </form>
    </div>
  );
}

function ClaimsTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(null);

  function load() {
    setLoading(true);
    api.get('/insurance/claims?status=submitted').then(setClaims).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      {loading && <Loading />}
      {!loading && claims.length === 0 && <EmptyState title="No claims awaiting a decision" />}
      {!loading && claims.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left">
                <th className="px-3 py-2.5 eyebrow font-medium">Description</th>
                <th className="px-3 py-2.5 eyebrow font-medium text-right">Amount</th>
                <th className="px-3 py-2.5 eyebrow font-medium">Status</th>
                <th className="px-3 py-2.5 eyebrow font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/50">
                  <td className="px-3 py-2.5">{c.description}</td>
                  <td className="px-3 py-2.5 num text-right">{formatMoney(c.claimAmount, company?.currency)}</td>
                  <td className="px-3 py-2.5"><span className={CLAIM_CHIP[c.status]}>{c.status}</span></td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="btn-ghost !text-accent" onClick={() => setDeciding(c)}>Decide</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deciding && <DecideForm claim={deciding} onClose={() => setDeciding(null)} onDecided={() => { setDeciding(null); load(); }} />}
    </div>
  );
}

function DecideForm({ claim, onClose, onDecided }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [approve, setApprove] = useState(true);
  const [decisionNote, setDecisionNote] = useState('');
  const [payoutAccountId, setPayoutAccountId] = useState('');
  const [claimsExpenseAccountId, setClaimsExpenseAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/accounts').then(setAccounts).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/insurance/claims/${claim._id}/decide`, { approve, decisionNote, payoutAccountId: approve ? payoutAccountId : undefined, claimsExpenseAccountId: approve ? claimsExpenseAccountId : undefined });
      toast(approve ? 'Claim approved and paid out.' : 'Claim rejected.', 'success');
      onDecided();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">Decide claim</p>
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={() => setApprove(true)} className={approve ? 'btn-primary flex-1' : 'btn-secondary flex-1'}>Approve</button>
          <button type="button" onClick={() => setApprove(false)} className={!approve ? 'btn-danger flex-1' : 'btn-secondary flex-1'}>Reject</button>
        </div>
        <div className="space-y-3">
          <div><label className="field-label">Decision note</label><input className="field-input" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} /></div>
          {approve && (
            <>
              <div>
                <label className="field-label">Pay out from</label>
                <select required className="field-input" value={payoutAccountId} onChange={(e) => setPayoutAccountId(e.target.value)}>
                  <option value="">Select…</option>
                  {accounts.filter((a) => a.isPaymentAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Claims expense account</label>
                <select required className="field-input" value={claimsExpenseAccountId} onChange={(e) => setClaimsExpenseAccountId(e.target.value)}>
                  <option value="">Select…</option>
                  {accounts.filter((a) => a.type === 'expense').map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Confirm decision'}</button>
        </div>
      </form>
    </div>
  );
}
