import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function Warehouse3plPage() {
  return (
    <div>
      <div className="mb-5">
        <p className="page-title">Warehouse (3PL)</p>
        <p className="text-sm text-ink-muted mt-1">Storage contracts, receiving, and billing for third-party logistics clients.</p>
      </div>
      <ContractsTab />
    </div>
  );
}

function ContractsTab() {
  const toast = useToast();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [active, setActive] = useState(null);

  function load() {
    setLoading(true);
    api.get('/warehouse-3pl/contracts').then(setContracts).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-base leading-none">add</span>
          New contract
        </button>
      </div>
      {loading && <Loading />}
      {!loading && contracts.length === 0 && <EmptyState title="No storage contracts yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create a contract</button>} />}
      {!loading && contracts.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  <th className="px-4 py-2.5 font-semibold">Rate/unit/day</th>
                  <th className="px-4 py-2.5 font-semibold">Stored qty</th>
                  <th className="px-4 py-2.5 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/40">
                    <td className="px-4 py-2.5 font-medium text-ink">{c.clientCustomerId?.name || c.clientCustomerId}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{c.productId?.name || c.productId}</td>
                    <td className="px-4 py-2.5 num">{formatMoney(c.ratePerUnitPerDay)}</td>
                    <td className="px-4 py-2.5">
                      <span className="chip-accent num">{c.storedQuantity ?? c.currentQuantity ?? 0}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setActive(c)}>Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showForm && <ContractForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {active && <ContractManage contract={active} onClose={() => setActive(null)} onChanged={load} />}
    </div>
  );
}

function ContractForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    branchId: '', clientCustomerId: '', productId: '', variantId: '',
    ratePerUnitPerDay: '', billingProductId: '', billingVariantId: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);

  const storedProduct = products.find((p) => p._id === form.productId);
  const billingProduct = products.find((p) => p._id === form.billingProductId);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/warehouse-3pl/contracts', {
        ...form,
        ratePerUnitPerDay: Number(form.ratePerUnitPerDay),
      });
      toast('Contract created.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <p className="font-display text-lg font-semibold text-ink mb-4">New storage contract</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Client</label>
            <select required className="field-input" value={form.clientCustomerId} onChange={(e) => setForm({ ...form, clientCustomerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Stored product</label>
            <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, variantId: '' })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Variant</label>
            <select required className="field-input" value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })} disabled={!storedProduct}>
              <option value="">Select…</option>
              {storedProduct?.variants?.map((v) => <option key={v._id} value={v._id}>{v.name || v.sku}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Rate per unit per day</label>
            <input type="number" step="any" required className="field-input num" value={form.ratePerUnitPerDay} onChange={(e) => setForm({ ...form, ratePerUnitPerDay: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Billing product (invoice line item)</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value, billingVariantId: '' })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Billing variant</label>
            <select required className="field-input" value={form.billingVariantId} onChange={(e) => setForm({ ...form, billingVariantId: e.target.value })} disabled={!billingProduct}>
              <option value="">Select…</option>
              {billingProduct?.variants?.map((v) => <option key={v._id} value={v._id}>{v.name || v.sku}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-rule">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function ContractManage({ contract, onClose, onChanged }) {
  const { company } = useAuth();
  const toast = useToast();
  const [receiveQty, setReceiveQty] = useState('');
  const [releaseQty, setReleaseQty] = useState('');
  const [fee, setFee] = useState({ periodStart: '', periodEnd: '' });
  const [feeResult, setFeeResult] = useState(null);
  const [bill, setBill] = useState({ periodStart: '', periodEnd: '' });
  const [busy, setBusy] = useState(false);

  async function handleReceive(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/warehouse-3pl/contracts/${contract._id}/receive`, { quantity: Number(receiveQty) });
      toast('Goods received.', 'success');
      setReceiveQty('');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/warehouse-3pl/contracts/${contract._id}/release`, { quantity: Number(releaseQty) });
      toast('Goods released.', 'success');
      setReleaseQty('');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleComputeFee(e) {
    e.preventDefault();
    setBusy(true);
    setFeeResult(null);
    try {
      const result = await api.get(`/warehouse-3pl/contracts/${contract._id}/fee?periodStart=${fee.periodStart}&periodEnd=${fee.periodEnd}`);
      setFeeResult(result);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleBill(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/warehouse-3pl/contracts/${contract._id}/bill`, bill);
      toast('Period billed.', 'success');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <p className="font-display text-lg font-semibold text-ink mb-1">{contract.clientCustomerId?.name || 'Contract'}</p>
        <p className="text-sm text-ink-muted mb-4">
          {contract.productId?.name} <span className="text-rule-strong">·</span> <span className="num">{formatMoney(contract.ratePerUnitPerDay, company?.currency)}</span>/unit/day <span className="text-rule-strong">·</span> Stored: <span className="chip-accent num align-middle">{contract.storedQuantity ?? contract.currentQuantity ?? 0}</span>
        </p>

        <div className="space-y-5">
          <form onSubmit={handleReceive} className="border-t border-rule pt-4">
            <p className="text-sm font-semibold text-ink mb-2">Receive goods</p>
            <div className="flex gap-2">
              <input type="number" step="any" required className="field-input num" placeholder="Quantity" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} />
              <button type="submit" disabled={busy} className="btn-secondary whitespace-nowrap">Receive</button>
            </div>
          </form>

          <form onSubmit={handleRelease} className="border-t border-rule pt-4">
            <p className="text-sm font-semibold text-ink mb-2">Release goods</p>
            <div className="flex gap-2">
              <input type="number" step="any" required className="field-input num" placeholder="Quantity" value={releaseQty} onChange={(e) => setReleaseQty(e.target.value)} />
              <button type="submit" disabled={busy} className="btn-secondary whitespace-nowrap">Release</button>
            </div>
          </form>

          <form onSubmit={handleComputeFee} className="border-t border-rule pt-4">
            <p className="text-sm font-semibold text-ink mb-2">Compute fee</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="field-label">Period start</label><input type="date" required className="field-input" value={fee.periodStart} onChange={(e) => setFee({ ...fee, periodStart: e.target.value })} /></div>
              <div><label className="field-label">Period end</label><input type="date" required className="field-input" value={fee.periodEnd} onChange={(e) => setFee({ ...fee, periodEnd: e.target.value })} /></div>
            </div>
            <button type="submit" disabled={busy} className="btn-secondary">Compute</button>
            {feeResult && (
              <p className="text-sm mt-2 num font-semibold text-accent-strong bg-accent-soft rounded-lg px-3 py-2">
                Fee: {formatMoney(feeResult.fee ?? feeResult.amount ?? feeResult.totalFee, company?.currency)}
              </p>
            )}
          </form>

          <form onSubmit={handleBill} className="border-t border-rule pt-4">
            <p className="text-sm font-semibold text-ink mb-2">Bill period</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="field-label">Period start</label><input type="date" required className="field-input" value={bill.periodStart} onChange={(e) => setBill({ ...bill, periodStart: e.target.value })} /></div>
              <div><label className="field-label">Period end</label><input type="date" required className="field-input" value={bill.periodEnd} onChange={(e) => setBill({ ...bill, periodEnd: e.target.value })} /></div>
            </div>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Billing…' : 'Bill'}</button>
          </form>
        </div>

        <div className="flex justify-end mt-5 pt-4 border-t border-rule">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
