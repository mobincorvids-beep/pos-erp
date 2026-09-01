import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const INVOICE_CHIP = { pending: 'chip-warning', paid: 'chip-accent', overdue: 'chip-danger', cancelled: 'chip-neutral' };
const COMPLAINT_CHIP = { open: 'chip-warning', assigned: 'chip-accent', resolved: 'chip-neutral' };

function initials(name) {
  if (!name) return '-';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

export function HousingSocietyPage() {
  const [tab, setTab] = useState('invoices');
  return (
    <div>
      <p className="eyebrow mb-1">Housing Society</p>
      <p className="page-title mb-5">Management Hub</p>
      <div className="flex gap-2 mb-5">
        {[['invoices', 'Invoices'], ['complaints', 'Complaints'], ['members', 'Members']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'complaints' && <ComplaintsTab />}
      {tab === 'members' && <MembersTab />}
    </div>
  );
}

function InvoicesTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [paying, setPaying] = useState(null);

  function load() {
    setLoading(true);
    api.get('/housing-society/invoices').then(setInvoices).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowGenerate(true)}>
          <span className="font-icon text-base leading-none">add</span>
          Generate invoices
        </button>
      </div>
      {loading && <Loading />}
      {!loading && invoices.length === 0 && <EmptyState title="No invoices yet" action={<button className="btn-primary" onClick={() => setShowGenerate(true)}>Generate a billing period</button>} />}
      {!loading && invoices.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left bg-surface-sunken/50">
                  <th className="px-4 py-3 eyebrow font-medium">Property</th>
                  <th className="px-4 py-3 eyebrow font-medium">Resident</th>
                  <th className="px-4 py-3 eyebrow font-medium">Period</th>
                  <th className="px-4 py-3 eyebrow font-medium text-right">Amount</th>
                  <th className="px-4 py-3 eyebrow font-medium">Status</th>
                  <th className="px-4 py-3 eyebrow font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/40 transition-colors">
                    <td className="px-4 py-3 num text-ink">{i.propertyId?.unitNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-xs font-semibold shrink-0">
                          {initials(i.residentCustomerId?.name)}
                        </span>
                        <span className="text-ink">{i.residentCustomerId?.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{i.period}</td>
                    <td className="px-4 py-3 num text-right">{formatMoney(i.amount, company?.currency)}</td>
                    <td className="px-4 py-3"><span className={INVOICE_CHIP[i.status]}>{i.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      {(i.status === 'pending' || i.status === 'overdue') && <button className="btn-ghost !text-accent !px-2 !py-1" onClick={() => setPaying(i)}>Pay</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showGenerate && <GenerateForm onClose={() => setShowGenerate(false)} onSaved={() => { setShowGenerate(false); load(); }} />}
      {paying && <PayForm invoice={paying} onClose={() => setPaying(null)} onPaid={() => { setPaying(null); load(); }} />}
    </div>
  );
}

function GenerateForm({ onClose, onSaved }) {
  const toast = useToast();
  const [charges, setCharges] = useState([]);
  const [chargeId, setChargeId] = useState('');
  const [period, setPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/housing-society/charges').then(setCharges).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post('/housing-society/invoices/generate', { chargeId, period, dueDate });
      toast(`Generated ${result.created.length} invoice(s)${result.skippedCount > 0 ? `: ${result.skippedCount} already billed for this period, skipped` : ''}.`, 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-1">Generate invoices</p>
        <p className="text-xs text-ink-muted mb-4">Bills every active member: anyone already billed for this exact period is skipped, never double-charged.</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Charge</label>
            <select required className="field-input" value={chargeId} onChange={(e) => setChargeId(e.target.value)}>
              <option value="">Charge…</option>
              {charges.map((c) => <option key={c._id} value={c._id}>{c.name}: {formatMoney(c.amount)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Period</label>
            <input required className="field-input" placeholder="e.g. 2026-08" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Due date</label>
            <input type="date" required className="field-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Generating…' : 'Generate'}</button>
        </div>
      </form>
    </div>
  );
}

function PayForm({ invoice, onClose, onPaid }) {
  const { company } = useAuth();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (branchId) api.get(`/org/warehouses?branchId=${branchId}`).then(setWarehouses).catch(() => {}); }, [branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/housing-society/invoices/${invoice._id}/pay`, { branchId, warehouseId, paymentAccountId });
      toast('Invoice paid.', 'success');
      onPaid();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-semibold text-ink mb-1">Pay invoice</p>
        <p className="text-sm text-ink-muted mb-4">{invoice.propertyId?.unitNumber}: <span className="num">{formatMoney(invoice.amount, company?.currency)}</span></p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Branch…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!branchId}>
              <option value="">Warehouse…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Payment account</label>
            <select required className="field-input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
              <option value="">Payment account…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Paying…' : 'Pay'}</button>
        </div>
      </form>
    </div>
  );
}

function ComplaintsTab() {
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignee, setAssignee] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  function load() {
    setLoading(true);
    api.get('/housing-society/complaints').then(setComplaints).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);
  useEffect(() => { if (assigning) api.get('/users').then(setUsers).catch(() => {}); }, [assigning]);

  async function assign() {
    try {
      await api.post(`/housing-society/complaints/${assigning}/assign`, { assignedToUserId: assignee });
      toast('Assigned.', 'success');
      setAssigning(null); setAssignee('');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function resolve() {
    try {
      await api.post(`/housing-society/complaints/${resolving}/resolve`, { resolutionNote });
      toast('Resolved.', 'success');
      setResolving(null); setResolutionNote('');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (complaints.length === 0) return <EmptyState title="No complaints" />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left bg-surface-sunken/50">
              <th className="px-4 py-3 eyebrow font-medium">Category</th>
              <th className="px-4 py-3 eyebrow font-medium">Description</th>
              <th className="px-4 py-3 eyebrow font-medium">Status</th>
              <th className="px-4 py-3 eyebrow font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/40 transition-colors">
                <td className="px-4 py-3 text-ink">{c.category}</td>
                <td className="px-4 py-3 text-ink-muted">{c.description}</td>
                <td className="px-4 py-3"><span className={COMPLAINT_CHIP[c.status]}>{c.status}</span></td>
                <td className="px-4 py-3 text-right">
                  {c.status === 'open' && assigning !== c._id && <button className="btn-ghost !text-accent !px-2 !py-1" onClick={() => setAssigning(c._id)}>Assign</button>}
                  {assigning === c._id && (
                    <div className="flex gap-1.5 justify-end items-center">
                      <select className="field-input !py-1.5 !text-xs !w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                        <option value="">To…</option>
                        {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                      </select>
                      <button className="btn-ghost !text-accent !px-2 !py-1" disabled={!assignee} onClick={assign}>Save</button>
                    </div>
                  )}
                  {c.status === 'assigned' && resolving !== c._id && <button className="btn-ghost !text-accent !px-2 !py-1" onClick={() => setResolving(c._id)}>Resolve</button>}
                  {resolving === c._id && (
                    <div className="flex gap-1.5 justify-end items-center">
                      <input className="field-input !py-1.5 !text-xs" placeholder="Resolution note" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} />
                      <button className="btn-ghost !text-accent !px-2 !py-1" disabled={!resolutionNote.trim()} onClick={resolve}>Save</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MembersTab() {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/housing-society/members').then(setMembers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (members.length === 0) return <EmptyState title="No members yet" />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left bg-surface-sunken/50">
              <th className="px-4 py-3 eyebrow font-medium">Property</th>
              <th className="px-4 py-3 eyebrow font-medium">Resident</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/40 transition-colors">
                <td className="px-4 py-3 num text-ink">{m.propertyId?.unitNumber || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-xs font-semibold shrink-0">
                      {initials(m.residentCustomerId?.name)}
                    </span>
                    <span className="text-ink">{m.residentCustomerId?.name || '-'}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
