import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const GOAL_STATUS_CHIP = {
  not_started: 'chip-neutral', in_progress: 'chip-accent', at_risk: 'chip-warning',
  completed: 'chip-accent', cancelled: 'chip-danger',
};
const REVIEW_STATUS_CHIP = { draft: 'chip-neutral', submitted: 'chip-warning', acknowledged: 'chip-accent' };

export function PerformancePage() {
  const [tab, setTab] = useState('goals');
  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">People &amp; Talent</p>
        <p className="page-title">Performance &amp; Goals</p>
        <p className="text-sm text-ink-muted mt-1">Goals, reviews, and employee scorecards</p>
      </div>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['goals', 'Goals'], ['reviews', 'Reviews'], ['scorecard', 'Scorecard']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'goals' && <GoalsTab />}
      {tab === 'reviews' && <ReviewsTab />}
      {tab === 'scorecard' && <ScorecardTab />}
    </div>
  );
}

// --- Goals -----------------------------------------------------------------

function GoalsTab() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [progressFor, setProgressFor] = useState(null);

  useEffect(() => { api.get('/hr/employees').then(setEmployees).catch(() => {}); }, []);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (employeeId) params.set('employeeId', employeeId);
    if (status) params.set('status', status);
    api.get(`/performance/goals?${params.toString()}`).then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [employeeId, status]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-between mb-3">
        <div className="flex flex-wrap gap-2">
          <select className="field-input !w-auto" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">All employees</option>
            {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
          <select className="field-input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['not_started', 'in_progress', 'at_risk', 'completed', 'cancelled'].map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        {can('performance.manage') && <button className="btn-primary" onClick={() => setShowForm(true)}>Add goal</button>}
      </div>

      {loading && <Loading />}
      {!loading && rows.length === 0 && <EmptyState title="No goals yet" description="Set individual, team, or company goals to track progress." />}
      {!loading && rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <p className="font-display font-bold text-ink">Goals ledger</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Goal</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Progress</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{g.employeeId?.name || '-'}</td>
                  <td className="px-4 py-2.5">
                    <div>{g.title}</div>
                    {g.description && <div className="text-xs text-ink-muted">{g.description}</div>}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-ink-muted">{g.category}</td>
                  <td className="px-4 py-2.5 num">{g.currentValue}{g.unit ? ` ${g.unit}` : ''} / {g.targetValue}{g.unit ? ` ${g.unit}` : ''}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{g.dueDate ? formatDate(g.dueDate) : '-'}</td>
                  <td className="px-4 py-2.5"><span className={GOAL_STATUS_CHIP[g.status] || 'chip-neutral'}>{g.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-2.5 text-right">
                    {can('performance.manage') && (
                      <button className="btn-ghost !text-accent" onClick={() => setProgressFor(g)}>Update</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <GoalForm employees={employees} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
      {progressFor && (
        <GoalProgressForm goal={progressFor} onClose={() => setProgressFor(null)} onSaved={() => { setProgressFor(null); load(); }} />
      )}
    </div>
  );
}

function GoalForm({ employees, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    employeeId: '', title: '', description: '', category: 'individual',
    targetValue: '', unit: '', dueDate: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/performance/goals', {
        employeeId: form.employeeId, title: form.title, description: form.description,
        category: form.category, targetValue: Number(form.targetValue) || 0,
        unit: form.unit, dueDate: form.dueDate || undefined,
      });
      toast('Goal created.', 'success');
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
        <p className="font-display text-lg mb-4">Add goal</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Employee</label>
            <select required className="field-input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select employee…</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Title</label><input required autoFocus className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="field-label">Description</label><input className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <label className="field-label">Category</label>
            <select className="field-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="individual">Individual</option>
              <option value="team">Team</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Target value</label><input type="number" className="field-input num" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} /></div>
            <div><label className="field-label">Unit</label><input className="field-input" placeholder="%, units, $" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
          </div>
          <div><label className="field-label">Due date</label><input type="date" className="field-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function GoalProgressForm({ goal, onClose, onSaved }) {
  const toast = useToast();
  const [currentValue, setCurrentValue] = useState(goal.currentValue);
  const [status, setStatus] = useState(goal.status);
  const [busy, setBusy] = useState(false);

  async function saveProgress() {
    setBusy(true);
    try {
      await api.post(`/performance/goals/${goal._id}/progress`, { currentValue: Number(currentValue) || 0 });
      toast('Progress updated.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function saveStatus() {
    setBusy(true);
    try {
      await api.post(`/performance/goals/${goal._id}/status`, { status });
      toast('Status updated.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{goal.title}</p>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="field-label">Current value ({goal.unit || 'value'}, target {goal.targetValue})</label>
            <div className="flex gap-2">
              <input type="number" className="field-input num" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
              <button className="btn-secondary shrink-0" disabled={busy} onClick={saveProgress}>Update</button>
            </div>
          </div>
          <div>
            <label className="field-label">Status</label>
            <div className="flex gap-2">
              <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {['not_started', 'in_progress', 'at_risk', 'completed', 'cancelled'].map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <button className="btn-secondary shrink-0" disabled={busy} onClick={saveStatus}>Update</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Reviews -----------------------------------------------------------------

function ReviewsTab() {
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { api.get('/hr/employees').then(setEmployees).catch(() => {}); }, []);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (employeeId) params.set('employeeId', employeeId);
    api.get(`/performance/reviews?${params.toString()}`).then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [employeeId]);

  async function submit(id) {
    try {
      await api.post(`/performance/reviews/${id}/submit`);
      toast('Review submitted.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function acknowledge(review) {
    try {
      await api.post(`/performance/reviews/${review._id}/acknowledge`, { employeeId: review.employeeId?._id || review.employeeId });
      toast('Review acknowledged.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-between mb-3">
        <select className="field-input !w-auto" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">All employees</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        {can('performance.manage') && <button className="btn-primary" onClick={() => setShowForm(true)}>New review</button>}
      </div>

      {loading && <Loading />}
      {!loading && rows.length === 0 && <EmptyState title="No performance reviews yet" />}
      {!loading && rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <p className="font-display font-bold text-ink">Reviews ledger</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Rating</th>
                <th className="px-4 py-2.5 font-medium">Reviewer</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.employeeId?.name || '-'}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{r.period}</td>
                  <td className="px-4 py-2.5 num">{r.overallRating ? `${r.overallRating}/5` : '-'}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{r.reviewerUserId?.name || r.reviewerUserId?.email || '-'}</td>
                  <td className="px-4 py-2.5"><span className={REVIEW_STATUS_CHIP[r.status] || 'chip-neutral'}>{r.status}</span></td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      {r.status === 'draft' && can('performance.manage') && (
                        <button className="btn-ghost !text-accent" onClick={() => submit(r._id)}>Submit</button>
                      )}
                      {r.status === 'submitted' && (
                        <button className="btn-ghost !text-accent" onClick={() => acknowledge(r)}>Acknowledge</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ReviewForm employees={employees} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ReviewForm({ employees, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ employeeId: '', period: '', overallRating: '', strengths: '', areasForImprovement: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/performance/reviews', {
        employeeId: form.employeeId, period: form.period,
        overallRating: form.overallRating ? Number(form.overallRating) : undefined,
        strengths: form.strengths, areasForImprovement: form.areasForImprovement,
      });
      toast('Review created as draft.', 'success');
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
        <p className="font-display text-lg mb-4">New performance review</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Employee</label>
            <select required className="field-input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select employee…</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Period</label><input required className="field-input" placeholder="e.g. 2026-Q1" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></div>
          <div>
            <label className="field-label">Overall rating (1-5)</label>
            <input type="number" min="1" max="5" className="field-input num" value={form.overallRating} onChange={(e) => setForm({ ...form, overallRating: e.target.value })} />
          </div>
          <div><label className="field-label">Strengths</label><textarea className="field-input" rows="2" value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} /></div>
          <div><label className="field-label">Areas for improvement</label><textarea className="field-input" rows="2" value={form.areasForImprovement} onChange={(e) => setForm({ ...form, areasForImprovement: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save draft'}</button>
        </div>
      </form>
    </div>
  );
}

// --- Scorecard -----------------------------------------------------------------

function ScorecardTab() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/hr/employees').then(setEmployees).catch(() => {}); }, []);

  useEffect(() => {
    if (!employeeId) { setScorecard(null); return; }
    setLoading(true);
    api.get(`/performance/scorecard/${employeeId}`).then(setScorecard).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, [employeeId]);

  return (
    <div>
      <select className="field-input !w-auto mb-4" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
        <option value="">Select employee…</option>
        {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
      </select>

      {!employeeId && <EmptyState title="Pick an employee" description="Select an employee to see their goals and latest review at a glance." />}
      {loading && <Loading />}

      {!loading && scorecard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="card p-4">
            <p className="eyebrow mb-1.5">Active goals</p>
            <p className="text-2xl font-display font-bold num text-ink">{scorecard.activeGoals}</p>
          </div>
          <div className="card p-4">
            <p className="eyebrow mb-1.5">Completed goals</p>
            <p className="text-2xl font-display font-bold num text-ink">{scorecard.completedGoals}</p>
          </div>
          <div className="card p-4">
            <p className="eyebrow mb-1.5">At risk</p>
            <p className="text-2xl font-display font-bold num text-ink">{scorecard.atRiskGoals}</p>
          </div>
          <div className="card p-4">
            <p className="eyebrow mb-1.5">Avg. progress</p>
            <p className="text-2xl font-display font-bold num text-ink">{scorecard.averageProgressPercent != null ? `${scorecard.averageProgressPercent}%` : '-'}</p>
          </div>
        </div>
      )}

      {!loading && scorecard?.latestReview && (
        <div className="card p-4 mb-5">
          <p className="eyebrow mb-2">Most recent review</p>
          <div className="flex items-center gap-3">
            <span className="text-lg font-display font-bold num text-ink">{scorecard.latestReview.overallRating ? `${scorecard.latestReview.overallRating}/5` : 'Not rated'}</span>
            <span className="text-sm text-ink-muted">{scorecard.latestReview.period}</span>
            <span className={REVIEW_STATUS_CHIP[scorecard.latestReview.status] || 'chip-neutral'}>{scorecard.latestReview.status}</span>
          </div>
        </div>
      )}

      {!loading && scorecard && scorecard.goals.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <p className="font-display font-bold text-ink">Goals</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-4 py-2.5 font-medium">Goal</th>
                <th className="px-4 py-2.5 font-medium">Progress</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {scorecard.goals.map((g) => (
                <tr key={g._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{g.title}</td>
                  <td className="px-4 py-2.5 num">{g.currentValue}{g.unit ? ` ${g.unit}` : ''} / {g.targetValue}{g.unit ? ` ${g.unit}` : ''}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{g.dueDate ? formatDate(g.dueDate) : '-'}</td>
                  <td className="px-4 py-2.5"><span className={GOAL_STATUS_CHIP[g.status] || 'chip-neutral'}>{g.status.replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
