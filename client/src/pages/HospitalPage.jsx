import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function HospitalPage() {
  const [tab, setTab] = useState('queue');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const toast = useToast();

  useEffect(() => {
    api.get('/org/branches').then((rows) => {
      setBranches(rows);
      if (rows.length > 0) setBranchId((prev) => prev || rows[0]._id);
    }).catch((err) => toast(err.message, 'error'));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="page-title">Hospital / OPD</p>
        <div className="min-w-[200px]">
          <select className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['queue', 'Queue'], ['checkin', 'Check-in'], ['visits', 'All visits']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'queue' && <QueueTab branchId={branchId} />}
      {tab === 'checkin' && <CheckInTab branchId={branchId} onCheckedIn={() => setTab('queue')} />}
      {tab === 'visits' && <VisitsTab branchId={branchId} />}
    </div>
  );
}

function QueueTab({ branchId }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);

  function load() {
    if (!branchId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    api.get(`/hospital/visits/queue?branchId=${branchId}`).then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [branchId]);

  async function callNext() {
    if (!branchId) return;
    setCalling(true);
    try {
      const visit = await api.post('/hospital/visits/call-next', { branchId });
      toast(`Now calling queue #${visit.queueNumber}.`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCalling(false);
    }
  }

  if (!branchId) return <EmptyState title="Select a branch to view its queue" />;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" disabled={calling} onClick={callNext}>{calling ? 'Calling…' : 'Call next'}</button>
      </div>
      {loading && <Loading />}
      {!loading && rows.length === 0 && <EmptyState title="No patients waiting" description="Check a patient in to start the queue." />}
      {!loading && rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Chief complaint</th>
                <th className="px-3 py-2 font-medium">Checked in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2 num">{v.queueNumber}</td>
                  <td className="px-3 py-2">{v.customerId?.name || '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{v.chiefComplaint || '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{new Date(v.checkedInAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CheckInTab({ branchId, onCheckedIn }) {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ customerId: '', chiefComplaint: '', consultationFee: '', billingProductId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!branchId) { toast('Select a branch first.', 'error'); return; }
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.billingProductId);
      await api.post('/hospital/visits/check-in', {
        branchId,
        customerId: form.customerId,
        chiefComplaint: form.chiefComplaint,
        consultationFee: Number(form.consultationFee) || 0,
        billingProductId: product?._id,
        billingVariantId: product?.variants?.[0]?._id,
      });
      toast('Patient checked in.', 'success');
      setForm({ customerId: '', chiefComplaint: '', consultationFee: '', billingProductId: '' });
      onCheckedIn?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 max-w-md">
      <p className="font-display text-lg mb-4">Check in a patient</p>
      <div className="space-y-3">
        <div>
          <label className="field-label">Patient</label>
          <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">Select…</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Chief complaint</label>
          <input className="field-input" value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} placeholder="e.g. Fever" />
        </div>
        <div>
          <label className="field-label">Consultation billing product (trackingMode "service")</label>
          <select className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}>
            <option value="">None</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Consultation fee</label>
          <input type="number" className="field-input num" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button type="submit" disabled={saving || !branchId} className="btn-primary">{saving ? 'Checking in…' : 'Check in'}</button>
      </div>
      {!branchId && <p className="text-xs text-warning mt-2">Select a branch above first.</p>}
    </form>
  );
}

function VisitsTab({ branchId }) {
  const { company } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [completing, setCompleting] = useState(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (status) params.set('status', status);
    api.get(`/hospital/visits?${params.toString()}`).then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [branchId, status]);

  async function cancel(visit) {
    try {
      await api.post(`/hospital/visits/${visit._id}/cancel`, {});
      toast('Visit cancelled.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <select className="field-input max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="waiting">Waiting</option>
          <option value="in_consultation">In consultation</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {loading && <Loading />}
      {!loading && rows.length === 0 && <EmptyState title="No visits found" />}
      {!loading && rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Doctor</th>
                <th className="px-3 py-2 font-medium">Fee</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2 num">{v.queueNumber}</td>
                  <td className="px-3 py-2">{v.customerId?.name || '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{v.employeeId?.name || '—'}</td>
                  <td className="px-3 py-2 num">{formatMoney(v.consultationFee, company?.currency)}</td>
                  <td className="px-3 py-2"><span className={v.status === 'completed' ? 'chip-accent' : v.status === 'cancelled' ? 'chip-danger' : 'chip-warning'}>{v.status}</span></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {v.status === 'in_consultation' && (
                      <button className="btn-ghost !text-accent !px-0 text-xs mr-3" onClick={() => setCompleting(v)}>Complete</button>
                    )}
                    {['waiting', 'in_consultation'].includes(v.status) && (
                      <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => cancel(v)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {completing && <CompleteVisitForm visit={completing} onClose={() => setCompleting(null)} onSaved={() => { setCompleting(null); load(); }} />}
    </div>
  );
}

function CompleteVisitForm({ visit, onClose, onSaved }) {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get(`/org/warehouses?branchId=${visit.branchId}`).then(setWarehouses).catch(() => {}); }, [visit.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/hospital/visits/${visit._id}/complete`, { warehouseId });
      toast('Visit completed and billed.', 'success');
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
        <p className="font-display text-lg mb-4">Complete visit #{visit.queueNumber}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Warehouse (for billing stock)</label>
            <select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Completing…' : 'Complete'}</button>
        </div>
      </form>
    </div>
  );
}
