import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const TABS = [
  { key: 'Work Orders', icon: 'build', labelKey: 'maintenance.workOrders' },
  { key: 'Plans', icon: 'event_repeat', labelKey: 'maintenance.plans' },
];

export function MaintenancePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('Work Orders');
  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <p className="page-title">{t('maintenance.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('maintenance.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {TABS.map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)} className={tab === tb.key ? 'pill-active' : 'pill'}>
              <span className="material-symbols-outlined text-sm mr-1 align-middle">{tb.icon}</span>
              {t(tb.labelKey)}
            </button>
          ))}
        </div>
      </div>
      {tab === 'Work Orders' && <WorkOrdersTab />}
      {tab === 'Plans' && <PlansTab />}
    </div>
  );
}

const STATUS_CHIP = {
  open: 'chip-info',
  in_progress: 'chip-warning',
  completed: 'chip-accent',
  cancelled: 'chip-neutral',
};

function StatusChip({ status }) {
  const cls = STATUS_CHIP[status] || 'chip-neutral';
  return (
    <span className={`${cls} gap-1.5 capitalize`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status?.replace('_', ' ')}
    </span>
  );
}

const PRIORITY_CHIP = {
  low: 'chip-neutral',
  medium: 'chip-info',
  high: 'chip-warning',
  critical: 'chip-danger',
};

function PriorityChip({ priority }) {
  const cls = PRIORITY_CHIP[priority] || 'chip-neutral';
  return <span className={`${cls} capitalize`}>{priority}</span>;
}

function Avatar({ name }) {
  const { t } = useTranslation();
  if (!name) {
    return <div className="w-8 h-8 rounded-full bg-surface-sunken border border-rule flex items-center justify-center text-[11px] font-semibold text-ink-muted">{t('maintenance.unassignedInitials')}</div>;
  }
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <div className="w-8 h-8 rounded-full bg-accent-soft border border-rule flex items-center justify-center text-[11px] font-semibold text-accent-strong">{initials}</div>;
}

function WorkOrdersTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [completing, setCompleting] = useState(null);

  function load() {
    setLoading(true);
    api.get('/maintenance/work-orders').then(setOrders).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function cancel(id) {
    if (!confirm(t('maintenance.cancelWorkOrderConfirm'))) return;
    try { await api.post(`/maintenance/work-orders/${id}/cancel`); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          {t('maintenance.newWorkOrder')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && orders.length === 0 && <EmptyState title={t('maintenance.noWorkOrders')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('maintenance.openOne')}</button>} />}
      {!loading && orders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">{t('maintenance.workOrders')}</p>
            <span className="eyebrow">{t('maintenance.ordersCount', { count: orders.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">{t('maintenance.assetIssue')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('maintenance.priority')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('maintenance.status')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('maintenance.technician')}</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">{t('maintenance.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {orders.map((o) => (
                  <tr key={o._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-sunken flex items-center justify-center text-ink-muted shrink-0">
                          <span className="material-symbols-outlined">build</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink">{o.assetId?.name}</p>
                          <p className="text-xs text-ink-muted">{o.issue}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5"><PriorityChip priority={o.priority} /></td>
                    <td className="py-3 px-5"><StatusChip status={o.status} /></td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <Avatar name={o.assignedTechnicianId?.name} />
                        <span className={`text-sm ${o.assignedTechnicianId ? 'text-ink' : 'text-ink-muted italic'}`}>{o.assignedTechnicianId?.name || t('maintenance.unassigned')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-right">
                      {(o.status === 'open' || o.status === 'in_progress') ? (
                        <div className="flex gap-3 justify-end">
                          <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setCompleting(o)}>{t('maintenance.complete')}</button>
                          <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => cancel(o._id)}>{t('maintenance.cancel')}</button>
                        </div>
                      ) : <span className="text-xs text-ink-muted">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showForm && <WorkOrderForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {completing && <CompleteForm workOrder={completing} onClose={() => setCompleting(null)} onSaved={() => { setCompleting(null); load(); }} />}
    </div>
  );
}

function WorkOrderForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [assets, setAssets] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ assetId: '', branchId: '', warehouseId: '', issue: '', priority: 'medium', assignedTechnicianId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/fixed-assets').then(setAssets).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/users').then(setUsers).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/maintenance/work-orders', { ...form, assignedTechnicianId: form.assignedTechnicianId || undefined });
      toast(t('maintenance.workOrderOpened'), 'success');
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
        <p className="font-display text-lg mb-4">{t('maintenance.newWorkOrder')}</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
            <option value="">{t('maintenance.assetEllipsis')}</option>
            {assets.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">{t('maintenance.branchEllipsis')}</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
            <option value="">{t('maintenance.warehouseForPartsEllipsis')}</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <input required className="field-input" placeholder={t('maintenance.issue')} value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} />
          <select className="field-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">{t('maintenance.low')}</option><option value="medium">{t('maintenance.medium')}</option><option value="high">{t('maintenance.high')}</option><option value="critical">{t('maintenance.critical')}</option>
          </select>
          <select className="field-input" value={form.assignedTechnicianId} onChange={(e) => setForm({ ...form, assignedTechnicianId: e.target.value })}>
            <option value="">{t('maintenance.assignTechnicianOptionalEllipsis')}</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('maintenance.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('maintenance.opening') : t('maintenance.open')}</button>
        </div>
      </form>
    </div>
  );
}

function CompleteForm({ workOrder, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [laborCost, setLaborCost] = useState(0);
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/accounts').then(setAccounts).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/maintenance/work-orders/${workOrder._id}/complete`, {
        laborCost: Number(laborCost),
        expenseAccountId: Number(laborCost) > 0 ? expenseAccountId : undefined,
        paymentAccountId: Number(laborCost) > 0 ? paymentAccountId : undefined,
      });
      toast(t('maintenance.workOrderCompleted'), 'success');
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
        <p className="font-display text-lg mb-4">{t('maintenance.completePrefix')} {workOrder.issue}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('maintenance.laborCost')}</label><input type="number" min="0" className="field-input num" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} /></div>
          {Number(laborCost) > 0 && (
            <>
              <div>
                <label className="field-label">{t('maintenance.expenseAccount')}</label>
                <select required className="field-input" value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)}>
                  <option value="">{t('maintenance.selectEllipsis')}</option>
                  {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">{t('maintenance.paidFrom')}</label>
                <select required className="field-input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                  <option value="">{t('maintenance.selectEllipsis')}</option>
                  {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('maintenance.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('maintenance.saving') : t('maintenance.complete')}</button>
        </div>
      </form>
    </div>
  );
}

function PlansTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/maintenance/plans').then(setPlans).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          {t('maintenance.newPlan')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && plans.length === 0 && <EmptyState title={t('maintenance.noMaintenancePlans')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('maintenance.createOne')}</button>} />}
      {!loading && plans.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">{t('maintenance.maintenancePlans')}</p>
            <span className="eyebrow">{t('maintenance.plansCount', { count: plans.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">{t('maintenance.planAsset')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('maintenance.frequency')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('maintenance.nextDue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {plans.map((p) => (
                  <tr key={p._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-sunken flex items-center justify-center text-ink-muted shrink-0">
                          <span className="material-symbols-outlined">event_repeat</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink">{p.name}</p>
                          <p className="text-xs text-ink-muted">{p.assetId?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-sm text-ink-muted num">{t('maintenance.everyDays', { days: p.frequencyDays })}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted">{formatDate(p.nextDueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showForm && <PlanForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function PlanForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({ assetId: '', name: '', frequencyDays: 90, nextDueDate: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/fixed-assets').then(setAssets).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/maintenance/plans', { ...form, frequencyDays: Number(form.frequencyDays) });
      toast(t('maintenance.planCreated'), 'success');
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
        <p className="font-display text-lg mb-4">{t('maintenance.newMaintenancePlan')}</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
            <option value="">{t('maintenance.assetEllipsis')}</option>
            {assets.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <input required className="field-input" placeholder={t('maintenance.planName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div><label className="field-label">{t('maintenance.everyDaysLabel')}</label><input type="number" min="1" required className="field-input num" value={form.frequencyDays} onChange={(e) => setForm({ ...form, frequencyDays: e.target.value })} /></div>
          <div><label className="field-label">{t('maintenance.firstDueDate')}</label><input type="date" required className="field-input" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('maintenance.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('maintenance.creating') : t('maintenance.create')}</button>
        </div>
      </form>
    </div>
  );
}
