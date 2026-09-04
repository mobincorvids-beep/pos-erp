import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function SchoolPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('students');
  return (
    <div>
      <p className="eyebrow mb-1">{t('school.eyebrow')}</p>
      <p className="page-title mb-5">{t('school.educationManagement')}</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['students', t('school.students')], ['fees', t('school.feeStructures')], ['invoices', t('school.invoices')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3.5 py-2.5 text-sm -mb-px border-b-2 transition-colors ${tab === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted font-medium hover:text-ink'}`}>
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
  const { t } = useTranslation();
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
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-ink-muted">{t('school.studentsEnrolledCount', { count: students.length })}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-base leading-none">add</span>
          {t('school.enrollStudent')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && students.length === 0 && <EmptyState title={t('school.noStudentsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('school.enrollOne')}</button>} />}
      {!loading && students.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                <th className="px-4 py-2.5 font-semibold">{t('school.name')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('school.class')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('school.guardian')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/60">
                  <td className="px-4 py-2.5 font-medium text-ink">{s.name}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{s.className || '-'}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{s.guardianName || '-'} {s.guardianPhone && <span className="num">· {s.guardianPhone}</span>}</td>
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
  const { t } = useTranslation();
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
      toast(t('school.studentEnrolled'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('school.enrollStudent')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('school.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">{t('school.class')}</label><input className="field-input" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder={t('school.classPlaceholder')} /></div>
          <div>
            <label className="field-label">{t('school.branch')}</label>
            <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('school.unassigned')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">{t('school.guardianName')}</label><input className="field-input" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} /></div>
          <div><label className="field-label">{t('school.guardianPhone')}</label><input className="field-input" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('school.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('school.enrolling') : t('school.enroll')}</button>
        </div>
      </form>
    </div>
  );
}

function FeeStructuresTab() {
  const { t } = useTranslation();
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
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-ink-muted">{t('school.feeStructuresCount', { count: structures.length })}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-base leading-none">add</span>
          {t('school.newFeeStructure')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && structures.length === 0 && <EmptyState title={t('school.noFeeStructuresYet')} />}
      {!loading && structures.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {structures.map((s) => (
            <div key={s._id} className="card p-4">
              <p className="text-sm font-semibold text-ink">{s.name}</p>
              <p className="text-xs text-ink-muted mt-1">{s.className || t('school.allClasses')} · {s.frequency}</p>
              <p className="num text-base font-semibold text-accent-strong mt-2">{formatMoney(s.amount)}</p>
              <button className="btn-ghost !text-accent !px-0 text-xs mt-2" onClick={() => setGenerating(s)}>{t('school.generateInvoices')}</button>
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
  const { t } = useTranslation();
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
      if (!product) throw new Error(t('school.selectBillingProduct'));
      await api.post('/school/fee-structures', { ...form, amount: Number(form.amount), billingVariantId: product.variants[0]?._id });
      toast(t('school.feeStructureCreated'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('school.newFeeStructure')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('school.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('school.feeNamePlaceholder')} /></div>
          <div><label className="field-label">{t('school.classBlankAll')}</label><input className="field-input" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} /></div>
          <div>
            <label className="field-label">{t('school.billingProductLabel')}</label>
            <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">{t('school.select')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">{t('school.amount')}</label><input type="number" required className="field-input num" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('school.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('school.saving') : t('school.save')}</button>
        </div>
      </form>
    </div>
  );
}

function GenerateInvoicesForm({ structure, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [period, setPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post('/school/fee-invoices/generate', { feeStructureId: structure._id, period, dueDate });
      toast(t('school.invoicesGenerated', { created: result.created.length, skipped: result.skippedCount }), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-1">{t('school.generateInvoices')}</p>
        <p className="text-sm text-ink-muted mb-4">{structure.name}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('school.period')}</label><input required className="field-input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder={t('school.periodPlaceholder')} /></div>
          <div><label className="field-label">{t('school.dueDate')}</label><input type="date" required className="field-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
        <p className="text-xs text-ink-muted mt-3">{t('school.safeToRunAgainHint')}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('school.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('school.generating') : t('school.generate')}</button>
        </div>
      </form>
    </div>
  );
}

function InvoicesTab() {
  const { t } = useTranslation();
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
      toast(t('school.invoicesFlaggedOverdue', { count: result.flagged }), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <select className="field-input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t('school.allStatuses')}</option>
          <option value="pending">{t('school.pending')}</option>
          <option value="overdue">{t('school.overdue')}</option>
          <option value="paid">{t('school.paid')}</option>
        </select>
        <button className="btn-secondary" onClick={flagOverdue}>
          <span className="font-icon text-base leading-none">flag</span>
          {t('school.flagOverdueInvoices')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && invoices.length === 0 && <EmptyState title={t('school.noInvoices')} />}
      {!loading && invoices.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                <th className="px-4 py-2.5 font-semibold">{t('school.student')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('school.period')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('school.due')}</th>
                <th className="px-4 py-2.5 font-semibold text-right">{t('school.amount')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('school.status')}</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/60">
                  <td className="px-4 py-2.5 font-medium text-ink">{inv.studentId?.name}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{inv.period}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-2.5 num text-right">{formatMoney(inv.amount, company?.currency)}</td>
                  <td className="px-4 py-2.5"><span className={inv.status === 'paid' ? 'chip-accent' : inv.status === 'overdue' ? 'chip-danger' : 'chip-neutral'}>{inv.status}</span></td>
                  <td className="px-4 py-2.5 text-right">{['pending', 'overdue'].includes(inv.status) && <button className="btn-ghost !text-accent" onClick={() => setPaying(inv)}>{t('school.pay')}</button>}</td>
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
  const { t } = useTranslation();
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
      toast(t('school.invoicePaid'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-1">{t('school.payInvoice')}</p>
        <p className="text-sm text-ink-muted mb-4 num">{formatMoney(invoice.amount, company?.currency)}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('school.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('school.select')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('school.warehouse')}</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">{t('school.select')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('school.paymentAccount')}</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">{t('school.select')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('school.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('school.paying') : t('school.pay')}</button>
        </div>
      </form>
    </div>
  );
}
