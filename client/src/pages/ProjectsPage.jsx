import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { planned: 'chip-neutral', in_progress: 'chip-info', completed: 'chip-accent', cancelled: 'chip-danger' };

export function ProjectsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const TASK_COLUMNS = [
    { key: 'todo', label: t('projects.todo') },
    { key: 'in_progress', label: t('projects.inProgress') },
    { key: 'review', label: t('projects.review') },
    { key: 'done', label: t('projects.done') },
  ];
  const TASK_PRIORITY_CHIP = { low: 'chip-neutral', medium: 'chip-info', high: 'chip-danger' };

  function load() {
    setLoading(true);
    api.get('/projects').then(setProjects).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="page-title mb-1">{t('projects.title')}</p>
          <p className="text-sm text-ink-muted">{t('projects.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('projects.newProject')}</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {loading && <Loading />}
          {!loading && projects.length === 0 && (
            <EmptyState title={t('projects.noProjectsYet')} description={t('projects.noProjectsDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('projects.createAProject')}</button>} />
          )}
          {!loading && projects.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-rule bg-surface-sunken/60">
                <p className="font-display text-lg font-semibold text-ink">{t('projects.activePortfolios')}</p>
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-sunken border-b border-rule">
                    <th className="px-5 py-3 eyebrow font-semibold">{t('projects.code')}</th>
                    <th className="px-5 py-3 eyebrow font-semibold">{t('projects.name')}</th>
                    <th className="px-5 py-3 eyebrow font-semibold">{t('projects.status')}</th>
                    <th className="px-5 py-3 eyebrow font-semibold text-right">{t('projects.budget')}</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr
                      key={p._id}
                      onClick={() => setSelected(p)}
                      className={`border-b border-rule last:border-0 cursor-pointer hover:bg-accent-soft/30 transition-colors ${selected?._id === p._id ? 'bg-accent-soft/40' : ''}`}
                    >
                      <td className="px-5 py-4 num text-ink-muted">{p.code}</td>
                      <td className="px-5 py-4 font-medium text-ink">{p.name}</td>
                      <td className="px-5 py-4"><span className={STATUS_CHIP[p.status]}>{p.status.replace('_', ' ')}</span></td>
                      <td className="px-5 py-4 num text-right">{formatMoney(p.budget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && <ProjectDetailPanel project={selected} onClose={() => setSelected(null)} onChanged={load} />}
      </div>

      {selected && <TaskBoard project={selected} />}

      {showForm && <ProjectForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ProjectForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name: '', budget: '', customerId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/projects', { name: form.name, budget: Number(form.budget) || 0, customerId: form.customerId || undefined });
      toast(t('projects.projectCreated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('projects.newProject')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('projects.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">{t('projects.budget')}</label><input type="number" className="field-input num" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
          <div>
            <label className="field-label">{t('projects.customerOptional')}</label>
            <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('projects.none')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('projects.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('projects.saving') : t('projects.save')}</button>
        </div>
      </form>
    </div>
  );
}

function ProjectDetailPanel({ project, onClose, onChanged }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [report, setReport] = useState(null);
  const [costs, setCosts] = useState([]);
  const [manualAmount, setManualAmount] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/projects/${project._id}/profitability`).then(setReport).catch((err) => toast(err.message, 'error'));
    api.get(`/projects/${project._id}/costs`).then(setCosts).catch(() => {});
  }
  useEffect(load, [project._id]);

  async function changeStatus(status) {
    try {
      await api.patch(`/projects/${project._id}/status`, { status });
      toast(t('projects.statusUpdated'), 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function logCost() {
    if (!manualAmount) return;
    setBusy(true);
    try {
      await api.post(`/projects/${project._id}/costs`, { amount: Number(manualAmount), note: manualNote });
      toast(t('projects.costLogged'), 'success');
      setManualAmount(''); setManualNote('');
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-lg font-semibold text-ink">{project.name}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('projects.close')}</button>
      </div>

      <div className="flex gap-1 mb-4 border-b border-rule">
        <button className={`px-3 py-2 text-sm font-medium ${tab === 'overview' ? 'text-accent-strong border-b-2 border-accent-strong' : 'text-ink-muted'}`} onClick={() => setTab('overview')}>{t('projects.overview')}</button>
        <button className={`px-3 py-2 text-sm font-medium ${tab === 'docs' ? 'text-accent-strong border-b-2 border-accent-strong' : 'text-ink-muted'}`} onClick={() => setTab('docs')}>{t('projects.docs')}</button>
      </div>

      {tab === 'docs' && <ProjectDocs project={project} />}

      {tab === 'overview' && (
      <>
      <div>
        <label className="field-label">{t('projects.status')}</label>
        <select className="field-input mb-4" value={project.status} onChange={(e) => changeStatus(e.target.value)}>
          <option value="planned">{t('projects.planned')}</option>
          <option value="in_progress">{t('projects.inProgress')}</option>
          <option value="completed">{t('projects.completed')}</option>
          <option value="cancelled">{t('projects.cancelled')}</option>
        </select>
      </div>

      {report && (
        <div className="bg-surface-sunken/60 rounded-lg p-4 mb-4">
          <p className="eyebrow mb-3">{t('projects.budgetUtilization')}</p>
          <div className="space-y-1.5 text-sm mb-3">
            <div className="flex justify-between"><span className="text-ink-muted">{t('projects.revenue')}</span><span className="num text-accent-strong">{formatMoney(report.revenue, company?.currency)}</span></div>
            {Object.entries(report.costBreakdown).map(([type, amount]) => (
              <div key={type} className="flex justify-between"><span className="text-ink-muted capitalize">{type} {t('projects.cost')}</span><span className="num">{formatMoney(amount, company?.currency)}</span></div>
            ))}
          </div>
          <div className="tear-line my-2" />
          <div className="flex justify-between text-base font-semibold mb-1">
            <span>{t('projects.profit')}</span>
            <span className={`num ${report.profit >= 0 ? 'text-accent-strong' : 'text-danger'}`}>{formatMoney(report.profit, company?.currency)}</span>
          </div>
          {report.budgetUtilization !== null && (
            <>
              <div className="w-full bg-surface-sunken rounded-full h-1.5 mt-3 mb-2">
                <div
                  className={`h-1.5 rounded-full ${report.budgetUtilization > 100 ? 'bg-danger' : 'bg-accent'}`}
                  style={{ width: `${Math.min(report.budgetUtilization, 100)}%` }}
                />
              </div>
              <p className="text-xs text-ink-muted">{t('projects.percentOfBudgetUsed', { percent: report.budgetUtilization, remaining: formatMoney(report.budgetRemaining, company?.currency) })}</p>
            </>
          )}
        </div>
      )}

      <p className="text-sm font-semibold text-ink mb-1 mt-2">{t('projects.logAManualCost')}</p>
      <p className="text-xs text-ink-muted mb-3">{t('projects.manualCostDescription')}</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="number" placeholder={t('projects.amount')} className="field-input num" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
        <input placeholder={t('projects.note')} className="field-input" value={manualNote} onChange={(e) => setManualNote(e.target.value)} />
      </div>
      <button className="btn-secondary w-full mb-5" disabled={busy || !manualAmount} onClick={logCost}>
        {busy ? t('projects.logging') : t('projects.logCost')}
      </button>

      <p className="text-sm font-semibold text-ink mb-2">{t('projects.costHistory')}</p>
      <div className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
        {costs.length === 0 && <p className="text-ink-muted">{t('projects.noCostsLoggedYet')}</p>}
        {costs.map((c) => (
          <div key={c._id} className="flex justify-between">
            <span className="text-ink-muted">{formatDate(c.date)}: {c.type}{c.note ? `: ${c.note}` : ''}</span>
            <span className="num">{formatMoney(c.amount, company?.currency)}</span>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}

function ProjectDocs({ project }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api.get(`/projects/${project._id}/docs`).then((rows) => {
      setDocs(rows);
      if (!selected && rows.length) pick(rows[0]);
    }).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [project._id]);

  function pick(doc) {
    setSelected(doc);
    setTitle(doc.title);
    setBody(doc.body || '');
  }

  function newDoc() {
    setSelected({ _id: null });
    setTitle('');
    setBody('');
  }

  async function save() {
    if (!title) return;
    setSaving(true);
    try {
      if (selected?._id) {
        const doc = await api.patch(`/projects/${project._id}/docs/${selected._id}`, { title, body });
        setSelected(doc);
      } else {
        const doc = await api.post(`/projects/${project._id}/docs`, { title, body });
        setSelected(doc);
      }
      toast(t('projects.docSaved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  async function remove(doc) {
    if (!window.confirm(t('projects.confirmDeleteDoc', { title: doc.title }))) return;
    try {
      await api.del(`/projects/${project._id}/docs/${doc._id}`);
      toast(t('projects.docDeleted'), 'success');
      setSelected(null);
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow">{t('projects.docs')}</p>
        <button className="btn-ghost !text-xs !px-2 !py-1" onClick={newDoc}>{t('projects.newDoc')}</button>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {docs.map((d) => (
          <button
            key={d._id}
            className={`chip ${selected?._id === d._id ? 'bg-accent-soft text-accent-strong' : 'bg-surface-sunken text-ink-muted'}`}
            onClick={() => pick(d)}
          >
            {d.title}
          </button>
        ))}
        {docs.length === 0 && <p className="text-xs text-ink-muted italic">{t('projects.noDocsYet')}</p>}
      </div>

      {selected !== null && (
        <div>
          <input className="field-input mb-2" placeholder={t('projects.docTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="field-input font-mono text-xs" rows={10} placeholder={t('projects.writeNotesPlaceholder')} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex justify-between mt-2">
            {selected?._id ? (
              <button className="btn-ghost !text-xs !text-danger" onClick={() => remove(selected)}>{t('projects.delete')}</button>
            ) : <span />}
            <button className="btn-primary !text-xs" disabled={saving || !title} onClick={save}>{saving ? t('projects.saving') : t('projects.saveDoc')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A task is "blocked" while any of its blockedByTaskIds isn't yet done. Warning only, never a hard block. */
function blockers(task) {
  return (task.blockedByTaskIds || []).filter((b) => b && b.status !== 'done');
}

function TaskBoard({ project }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailTask, setDetailTask] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const TASK_COLUMNS = [
    { key: 'todo', label: t('projects.todo') },
    { key: 'in_progress', label: t('projects.inProgress') },
    { key: 'review', label: t('projects.review') },
    { key: 'done', label: t('projects.done') },
  ];

  function load() {
    setLoading(true);
    api.get(`/tasks?projectId=${project._id}`).then(setTasks).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [project._id]);
  useEffect(() => { api.get('/hr/employees').then(setEmployees).catch(() => {}); }, []);

  const boardTasks = tasks.filter((t) => !t.parentTaskId).map((t) => {
    const subs = tasks.filter((s) => s.parentTaskId === t._id);
    return { ...t, subtaskCount: subs.length, subtaskDone: subs.filter((s) => s.status === 'done').length };
  });

  async function moveTask(task, status) {
    const blocked = blockers(task);
    if (blocked.length && ['in_progress', 'done'].includes(status)) {
      const ok = window.confirm(t('projects.confirmMoveBlockedTask', { title: task.title, blockers: blocked.map((b) => b.title).join(', ') }));
      if (!ok) return;
    }
    try {
      await api.patch(`/tasks/${task._id}/status`, { status });
      setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status } : t)));
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteTask(task) {
    if (!window.confirm(t('projects.confirmDeleteTask', { title: task.title }))) return;
    try {
      await api.del(`/tasks/${task._id}`);
      toast(t('projects.taskDeleted'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  function handleDrop(e, colKey) {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/task-id');
    const task = tasks.find((t) => t._id === taskId);
    if (task && task.status !== colKey) moveTask(task, colKey);
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="eyebrow mb-1">{t('projects.tasks')}</p>
          <p className="font-display text-lg font-semibold text-ink">{t('projects.taskBoardTitle', { name: project.name })}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('projects.newTask')}</button>
      </div>

      {loading && <Loading />}
      {!loading && boardTasks.length === 0 && (
        <EmptyState title={t('projects.noTasksYet')} description={t('projects.noTasksDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('projects.createATask')}</button>} />
      )}
      {!loading && boardTasks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TASK_COLUMNS.map((col) => (
            <div
              key={col.key}
              className={`bg-surface-sunken/60 rounded-lg p-3 min-h-[120px] transition-colors ${dragOverCol === col.key ? 'ring-2 ring-accent' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
              onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="eyebrow">{col.label}</p>
                <span className="text-xs text-ink-muted num">{boardTasks.filter((t) => t.status === col.key).length}</span>
              </div>
              <div className="space-y-2">
                {boardTasks.filter((t) => t.status === col.key).map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    onClick={() => setDetailTask(task)}
                    onDelete={() => deleteTask(task)}
                  />
                ))}
                {boardTasks.filter((t) => t.status === col.key).length === 0 && (
                  <p className="text-xs text-ink-muted italic">{t('projects.noTasks')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TaskForm
          project={project}
          employees={employees}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          project={project}
          task={detailTask}
          allTasks={tasks}
          employees={employees}
          onClose={() => setDetailTask(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onClick, onDelete }) {
  const { t } = useTranslation();
  const blocked = blockers(task);
  return (
    <div
      className="card p-3 bg-paper cursor-grab active:cursor-grabbing hover:border-accent/50 transition-colors"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/task-id', task._id)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-medium text-ink text-sm">{task.title}</p>
        <span className={TASK_PRIORITY_CHIP[task.priority]}>{task.priority}</span>
      </div>
      {task.description && <p className="text-xs text-ink-muted mb-2 line-clamp-2">{task.description}</p>}
      <div className="text-xs text-ink-muted space-y-0.5 mb-2">
        {task.assigneeId && <p>{t('projects.assignee')}: {task.assigneeId.name || '-'}</p>}
        {task.dueDate && <p>{t('projects.due')}: {formatDate(task.dueDate)}</p>}
        {task.subtaskCount > 0 && <p>{t('projects.subtasks')}: {task.subtaskDone || 0}/{task.subtaskCount}</p>}
      </div>
      {blocked.length > 0 && (
        <div className="chip-danger !text-xs mb-2 inline-block">{t('projects.blockedBy')}: {blocked.map((b) => b.title).join(', ')}</div>
      )}
      <div className="flex items-center justify-end gap-1 mt-2">
        <button className="btn-ghost !text-xs !px-2 !py-1 !text-danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>{t('projects.delete')}</button>
      </div>
    </div>
  );
}

const TASK_PRIORITY_CHIP = { low: 'chip-neutral', medium: 'chip-info', high: 'chip-danger' };

function TaskForm({ project, employees, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ title: '', description: '', assigneeId: '', dueDate: '', priority: 'medium' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        assigneeId: form.assigneeId || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
      };
      await api.post('/tasks', { ...payload, projectId: project._id });
      toast(t('projects.taskCreated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('projects.newTask')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('projects.taskTitle')}</label>
            <input required autoFocus className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('projects.description')}</label>
            <textarea className="field-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('projects.assignee')}</label>
            <select className="field-input" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
              <option value="">{t('projects.unassigned')}</option>
              {employees.map((emp) => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('projects.dueDate')}</label>
              <input type="date" className="field-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('projects.priority')}</label>
              <select className="field-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">{t('projects.low')}</option>
                <option value="medium">{t('projects.medium')}</option>
                <option value="high">{t('projects.high')}</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('projects.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('projects.saving') : t('projects.save')}</button>
        </div>
      </form>
    </div>
  );
}

/** Full task detail: edit fields, subtasks checklist, custom fields, dependencies. */
function TaskDetailModal({ project, task, allTasks, employees, onClose, onChanged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    assigneeId: task.assigneeId?._id || task.assigneeId || '',
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    priority: task.priority,
  });
  const [saving, setSaving] = useState(false);

  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');

  const [customFields, setCustomFields] = useState(task.customFields || []);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  const [blockedByTaskIds, setBlockedByTaskIds] = useState((task.blockedByTaskIds || []).map((b) => b._id || b));

  function loadSubtasks() {
    api.get(`/tasks/${task._id}/subtasks`).then(setSubtasks).catch(() => {});
  }
  useEffect(loadSubtasks, [task._id]);

  const otherTasks = allTasks.filter((t) => t._id !== task._id && !t.parentTaskId);
  const blocked = blockers(task);

  async function saveFields() {
    setSaving(true);
    try {
      await api.patch(`/tasks/${task._id}`, {
        title: form.title,
        description: form.description,
        assigneeId: form.assigneeId || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
        customFields,
        blockedByTaskIds,
      });
      toast(t('projects.taskUpdated'), 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  async function addSubtask() {
    if (!newSubtask.trim()) return;
    try {
      await api.post('/tasks', { projectId: project._id, title: newSubtask.trim(), parentTaskId: task._id });
      setNewSubtask('');
      loadSubtasks();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function toggleSubtask(sub) {
    try {
      await api.patch(`/tasks/${sub._id}/status`, { status: sub.status === 'done' ? 'todo' : 'done' });
      loadSubtasks();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteSubtask(sub) {
    try {
      await api.del(`/tasks/${sub._id}`);
      loadSubtasks();
    } catch (err) { toast(err.message, 'error'); }
  }

  function addCustomField() {
    if (!newFieldKey.trim()) return;
    setCustomFields((prev) => [...prev, { key: newFieldKey.trim(), value: newFieldValue }]);
    setNewFieldKey('');
    setNewFieldValue('');
  }

  function updateCustomField(i, value) {
    setCustomFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, value } : f)));
  }

  function removeCustomField(i) {
    setCustomFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  function toggleBlocker(id) {
    setBlockedByTaskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const subtaskDone = subtasks.filter((s) => s.status === 'done').length;

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4 py-8 overflow-y-auto">
      <div className="card p-6 w-full max-w-lg my-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg font-semibold text-ink">{t('projects.taskDetails')}</p>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('projects.close')}</button>
        </div>

        {blocked.length > 0 && (
          <div className="chip-danger !text-xs mb-3 block w-fit">{t('projects.blockedByNotDone', { blockers: blocked.map((b) => b.title).join(', ') })}</div>
        )}

        <div className="space-y-3 mb-5">
          <div>
            <label className="field-label">{t('projects.taskTitle')}</label>
            <input className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('projects.description')}</label>
            <textarea className="field-input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('projects.assignee')}</label>
              <select className="field-input" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
                <option value="">{t('projects.unassigned')}</option>
                {employees.map((emp) => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">{t('projects.priority')}</label>
              <select className="field-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">{t('projects.low')}</option>
                <option value="medium">{t('projects.medium')}</option>
                <option value="high">{t('projects.high')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">{t('projects.dueDate')}</label>
            <input type="date" className="field-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </div>

        <div className="mb-5">
          <p className="text-sm font-semibold text-ink mb-2">{t('projects.subtasks')} {subtasks.length > 0 && <span className="text-ink-muted font-normal">({subtaskDone}/{subtasks.length})</span>}</p>
          <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
            {subtasks.map((sub) => (
              <div key={sub._id} className="flex items-center gap-2">
                <input type="checkbox" checked={sub.status === 'done'} onChange={() => toggleSubtask(sub)} />
                <span className={`text-sm flex-1 ${sub.status === 'done' ? 'line-through text-ink-muted' : 'text-ink'}`}>{sub.title}</span>
                <button className="btn-ghost !text-xs !px-2 !py-0.5 !text-danger" onClick={() => deleteSubtask(sub)}>✕</button>
              </div>
            ))}
            {subtasks.length === 0 && <p className="text-xs text-ink-muted italic">{t('projects.noSubtasksYet')}</p>}
          </div>
          <div className="flex gap-2">
            <input className="field-input flex-1" placeholder={t('projects.addASubtask')} value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())} />
            <button type="button" className="btn-secondary !text-xs" onClick={addSubtask}>{t('projects.add')}</button>
          </div>
        </div>

        <div className="mb-5">
          <p className="text-sm font-semibold text-ink mb-2">{t('projects.customFields')}</p>
          <div className="space-y-1.5 mb-2">
            {customFields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-ink-muted w-24 truncate shrink-0">{f.key}</span>
                <input className="field-input flex-1 !py-1 !text-xs" value={f.value} onChange={(e) => updateCustomField(i, e.target.value)} />
                <button className="btn-ghost !text-xs !px-2 !py-0.5 !text-danger" onClick={() => removeCustomField(i)}>✕</button>
              </div>
            ))}
            {customFields.length === 0 && <p className="text-xs text-ink-muted italic">{t('projects.noCustomFieldsYet')}</p>}
          </div>
          <div className="flex gap-2">
            <input className="field-input w-28 !text-xs" placeholder={t('projects.fieldName')} value={newFieldKey} onChange={(e) => setNewFieldKey(e.target.value)} />
            <input className="field-input flex-1 !text-xs" placeholder={t('projects.value')} value={newFieldValue} onChange={(e) => setNewFieldValue(e.target.value)} />
            <button type="button" className="btn-secondary !text-xs" onClick={addCustomField}>{t('projects.add')}</button>
          </div>
        </div>

        <div className="mb-5">
          <p className="text-sm font-semibold text-ink mb-2">{t('projects.blockedBy')}</p>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {otherTasks.length === 0 && <p className="text-xs text-ink-muted italic">{t('projects.noOtherTasks')}</p>}
            {otherTasks.map((t2) => (
              <label key={t2._id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={blockedByTaskIds.includes(t2._id)} onChange={() => toggleBlocker(t2._id)} />
                <span className="text-ink">{t2.title}</span>
                <span className={TASK_PRIORITY_CHIP[t2.status === 'done' ? 'low' : 'high']}>{t2.status.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>{t('projects.close')}</button>
          <button className="btn-primary" disabled={saving} onClick={saveFields}>{saving ? t('projects.saving') : t('projects.saveChanges')}</button>
        </div>
      </div>
    </div>
  );
}
