import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function ElectronicsPage() {
  const [tab, setTab] = useState('warranties');
  return (
    <div>
      <p className="page-title mb-4">Electronics</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['warranties', 'Warranties'], ['claims', 'Claims']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'warranties' && <WarrantiesTab />}
      {tab === 'claims' && <ClaimsTab />}
    </div>
  );
}

function WarrantiesTab() {
  const toast = useToast();
  const [checkSerial, setCheckSerial] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function handleCheck(e) {
    e.preventDefault();
    if (!checkSerial.trim()) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await api.get(`/electronics/warranties/${encodeURIComponent(checkSerial.trim())}/check`);
      setCheckResult(result);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <p className="font-display text-base mb-3">Check warranty</p>
        <form onSubmit={handleCheck} className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="field-label">Serial number</label>
            <input className="field-input" value={checkSerial} onChange={(e) => setCheckSerial(e.target.value)} placeholder="e.g. SN-00123" />
          </div>
          <button type="submit" disabled={checking} className="btn-primary">{checking ? 'Checking…' : 'Check'}</button>
        </form>
        {checkResult && (
          <div className="mt-4 border-t border-rule pt-3 text-sm">
            {!checkResult.found && <p className="text-ink-muted">No warranty found for this serial.</p>}
            {checkResult.found && (
              <div className="space-y-1">
                <p>
                  <span className={checkResult.underWarranty ? 'chip-accent' : 'chip-danger'}>
                    {checkResult.underWarranty ? 'Under warranty' : 'Expired'}
                  </span>
                </p>
                {checkResult.underWarranty && <p className="text-ink-muted">{checkResult.daysRemaining} day(s) remaining</p>}
                {!checkResult.underWarranty && <p className="text-ink-muted">Expired {checkResult.daysExpired} day(s) ago</p>}
                <p className="text-ink-muted">Expiry date: {new Date(checkResult.warranty.expiryDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setShowForm(true)}>Register warranty</button>
      </div>

      {showForm && <RegisterWarrantyForm onClose={() => setShowForm(false)} onSaved={() => setShowForm(false)} />}
    </div>
  );
}

function RegisterWarrantyForm({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ serialNumber: '', warrantyMonths: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/electronics/warranties', { serialNumber: form.serialNumber, warrantyMonths: Number(form.warrantyMonths) });
      toast('Warranty registered.', 'success');
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
        <p className="font-display text-lg mb-4">Register warranty</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Serial number</label>
            <input required autoFocus className="field-input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Must already be received & sold" />
          </div>
          <div>
            <label className="field-label">Warranty length (months)</label>
            <input type="number" required min="1" className="field-input num" value={form.warrantyMonths} onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })} />
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

const CLAIM_STATUS_CHIP = {
  submitted: 'chip-warning',
  approved: 'chip-accent',
  rejected: 'chip-danger',
  in_repair: 'chip-warning',
  resolved: 'chip-accent',
};

function ClaimsTab() {
  const toast = useToast();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [repairFor, setRepairFor] = useState(null);

  function load() {
    setLoading(true);
    api.get('/electronics/claims').then(setClaims).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function decide(claim, approve) {
    try {
      await api.post(`/electronics/claims/${claim._id}/decide`, { approve });
      toast(approve ? 'Claim approved.' : 'Claim rejected.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function resolve(claim) {
    try {
      await api.post(`/electronics/claims/${claim._id}/resolve`);
      toast('Claim resolved.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>File claim</button>
      </div>
      {loading && <Loading />}
      {!loading && claims.length === 0 && (
        <EmptyState title="No claims yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>File a claim</button>} />
      )}
      {!loading && claims.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Issue</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{c.issueDescription}</td>
                  <td className="px-3 py-2"><span className={CLAIM_STATUS_CHIP[c.status] || 'chip-warning'}>{c.status}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {c.status === 'submitted' && (
                        <>
                          <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => decide(c, true)}>Approve</button>
                          <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => decide(c, false)}>Reject</button>
                        </>
                      )}
                      {c.status === 'approved' && (
                        <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setRepairFor(c)}>Open repair job</button>
                      )}
                      {c.status === 'in_repair' && (
                        <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => resolve(c)}>Resolve</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <FileClaimForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {repairFor && <RepairJobForm claim={repairFor} onClose={() => setRepairFor(null)} onSaved={() => { setRepairFor(null); load(); }} />}
    </div>
  );
}

function FileClaimForm({ onClose, onSaved }) {
  const toast = useToast();
  const [serialNumber, setSerialNumber] = useState('');
  const [looking, setLooking] = useState(false);
  const [warranty, setWarranty] = useState(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function lookup(e) {
    e.preventDefault();
    if (!serialNumber.trim()) return;
    setLooking(true);
    setWarranty(null);
    try {
      const result = await api.get(`/electronics/warranties/${encodeURIComponent(serialNumber.trim())}/check`);
      if (!result.found) {
        toast('No warranty found for this serial.', 'error');
      } else {
        setWarranty(result.warranty);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLooking(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!warranty) return;
    setSaving(true);
    try {
      await api.post(`/electronics/warranties/${warranty._id}/claims`, { issueDescription });
      toast('Claim filed.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">File claim</p>
        {!warranty && (
          <form onSubmit={lookup} className="space-y-3">
            <div>
              <label className="field-label">Serial number</label>
              <input required autoFocus className="field-input" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Look up the warranty first" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={looking} className="btn-primary">{looking ? 'Looking up…' : 'Find warranty'}</button>
            </div>
          </form>
        )}
        {warranty && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-ink-muted">Warranty for serial <span className="font-medium text-ink">{warranty.serialNumber}</span>, expires {new Date(warranty.expiryDate).toLocaleDateString()}.</p>
            <div>
              <label className="field-label">Issue description</label>
              <textarea required autoFocus className="field-input" rows={3} value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-secondary" onClick={() => setWarranty(null)}>Back</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Filing…' : 'File claim'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function RepairJobForm({ claim, onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', itemDescription: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/electronics/claims/${claim._id}/repair-job`, form);
      toast('Repair job opened.', 'success');
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
        <p className="font-display text-lg mb-4">Open repair job</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, warehouseId: '' })}>
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
          <div>
            <label className="field-label">Item description</label>
            <input required className="field-input" value={form.itemDescription} onChange={(e) => setForm({ ...form, itemDescription: e.target.value })} placeholder="e.g. Laptop, screen replacement" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Opening…' : 'Open job'}</button>
        </div>
      </form>
    </div>
  );
}
