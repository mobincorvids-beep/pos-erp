import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function SchoolPage() {
  const [tab, setTab] = useState('students');
  return (
    <div>
      <p className="page-title mb-4">School</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['students', 'Students'], ['fees', 'Fee structures'], ['invoices', 'Invoices']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'students' && <StudentsTab />}
      {tab === 'fees' && <FeeStructuresTab />}
      {tab === 'invoices' && <InvoicesTab />}
    </div>
  );
}

function StudentsTab() {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/school/students').then(setStudents).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>Enroll student</button>
      </div>
      {loading && <Loading />}
      {!loading && students.length === 0 && <EmptyState title="No students enrolled yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Enroll one</button>} />}
      {!loading && students.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Class</th>
                <th className="px-3 py-2 font-medium">Guardian</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{s.className || '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{s.guardianName || '—'} {s.guardianPhone && `· ${s.guardianPhone}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <StudentForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function StudentForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', name: '', className: '', guardianName: '', guardianPhone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/school/students', form);
      toast('Student enrolled.', 'success');
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
        <p className="font-display text-lg mb-4">Enroll student</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Class</label><input className="field-input" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="e.g. Grade 5" /></div>
          <div>
            <label className="field-label">Branch</label>
            <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Unassigned</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Guardian name</label><input className="field-input" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} /></div>
          <div><label className="field-label">Guardian phone</label><input className="field-input" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Enrolling…' : 'Enroll'}</button>
        </div>
      </form>
    </div>
  );
}

function FeeStructuresTab() {
  const toast = useToast();
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(null);

  function load() {
    setLoading(true);
    api.get('/school/fee-structures').then(setStructures).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>New fee structure</button>
      </div>
      {loading && <Loading />}
      {!loading && structures.length === 0 && <EmptyState title="No fee structures yet" />}
      {!loading && structures.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {structures.map((s) => (
            <div key={s._id} className="card p-3">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-ink-muted mt-1">{s.className || 'All classes'} · {s.frequency}</p>
              <p className="num text-sm text-accent-strong mt-1">{formatMoney(s.amount)}</p>
              <button className="btn-ghost !text-accent !px-0 text-xs mt-2" onClick={() => setGenerating(s)}>Generate invoices</button>
            </div>
          ))}
        </div>
      )}
      {showForm && <FeeStructureForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {generating && <GenerateInvoicesForm structure={generating} onClose={() => setGenerating(null)} />}
    </div>
  );
}

function FeeStructureForm({ onClose, onSaved }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ productId: '', name: '', className: '', amount: '', frequency: 'monthly' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.productId);
      if (!product) throw new Error('Select a billing product.');
      await api.post('/school/fee-structures', { ...form, amount: Number(form.amount), billingVariantId: product.variants[0]?._id });
      toast('Fee structure created.', 'success');
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
        <p className="font-display text-lg mb-4">New fee structure</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grade 5 Tuition" /></div>
          <div><label className="field-label">Class (blank = all)</label><input className="field-input" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} /></div>
          <div>
            <label className="field-label">Billing product (trackingMode "service")</label>
            <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Amount</label><input type="number" required className="field-input num" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function GenerateInvoicesForm({ structure, onClose }) {
  const toast = useToast();
  const [period, setPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post('/school/fee-invoices/generate', { feeStructureId: structure._id, period, dueDate });
      toast(`Created ${result.created.length} invoice(s), ${result.skippedCount} already existed for this period.`, 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs">
        <p className="font-display text-lg mb-1">Generate invoices</p>
        <p className="text-sm text-ink-muted mb-4">{structure.name}</p>
        <div className="space-y-3">
          <div><label className="field-label">Period</label><input required className="field-input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 2026-08" /></div>
          <div><label className="field-label">Due date</label><input type="date" required className="field-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
        <p className="text-xs text-ink-muted mt-3">Safe to run again — students already invoiced for this period are skipped, not duplicated.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Generating…' : 'Generate'}</button>
        </div>
      </form>
    </div>
  );
}

function InvoicesTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [paying, setPaying] = useState(null);

  function load() {
    setLoading(true);
    const query = statusFilter ? `?status=${statusFilter}` : '';
    api.get(`/school/fee-invoices${query}`).then(setInvoices).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  async function flagOverdue() {
    try {
      const result = await api.post('/school/fee-invoices/flag-overdue');
      toast(`${result.flagged} invoice(s) flagged overdue.`, 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <select className="field-input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
        <button className="btn-secondary" onClick={flagOverdue}>Flag overdue invoices</button>
      </div>
      {loading && <Loading />}
      {!loading && invoices.length === 0 && <EmptyState title="No invoices" />}
      {!loading && invoices.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{inv.studentId?.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{inv.period}</td>
                  <td className="px-3 py-2 text-ink-muted">{formatDate(inv.dueDate)}</td>
                  <td className="px-3 py-2 num text-right">{formatMoney(inv.amount, company?.currency)}</td>
                  <td className="px-3 py-2"><span className={inv.status === 'paid' ? 'chip-accent' : inv.status === 'overdue' ? 'chip-danger' : 'chip-neutral'}>{inv.status}</span></td>
                  <td className="px-3 py-2 text-right">{['pending', 'overdue'].includes(inv.status) && <button className="btn-ghost !text-accent" onClick={() => setPaying(inv)}>Pay</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paying && <PayInvoiceForm invoice={paying} onClose={() => setPaying(null)} onPaid={() => { setPaying(null); load(); }} />}
    </div>
  );
}

function PayInvoiceForm({ invoice, onClose, onPaid }) {
  const { company } = useAuth();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', paymentAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/school/fee-invoices/${invoice._id}/pay`, form);
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
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs">
        <p className="font-display text-lg mb-1">Pay invoice</p>
        <p className="text-sm text-ink-muted mb-4 num">{formatMoney(invoice.amount, company?.currency)}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
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
            <label className="field-label">Payment account</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">Select…</option>
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
