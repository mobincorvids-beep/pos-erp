import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
const STAGE_LABELS = { applied: 'Applied', screening: 'Screening', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected' };
const NEXT_STAGE = { applied: 'screening', screening: 'interview', interview: 'offer' };

export function RecruitmentPage() {
  const [tab, setTab] = useState('openings');
  const [selectedOpening, setSelectedOpening] = useState(null); // job opening to scope the candidates tab to, or null for "all"

  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">People &amp; Talent</p>
        <p className="page-title">Recruitment</p>
        <p className="text-sm text-ink-muted mt-1">Job openings, candidates, and hiring pipeline</p>
      </div>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['openings', 'Job openings'], ['candidates', 'Candidates'], ['pipeline', 'Pipeline']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'openings' && <JobOpeningsTab onViewCandidates={(opening) => { setSelectedOpening(opening); setTab('candidates'); }} />}
      {tab === 'candidates' && <CandidatesTab initialOpening={selectedOpening} />}
      {tab === 'pipeline' && <PipelineTab />}
    </div>
  );
}

// --- Job openings ----------------------------------------------------------

function JobOpeningsTab({ onViewCandidates }) {
  const toast = useToast();
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/recruitment/job-openings').then(setOpenings).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function close(id) {
    try {
      await api.post(`/recruitment/job-openings/${id}/close`);
      toast('Job opening closed.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>New job opening</button>
      </div>

      {loading && <Loading />}
      {!loading && openings.length === 0 && (
        <EmptyState title="No job openings yet" description="Post a vacancy to start receiving candidates." action={<button className="btn-primary" onClick={() => setShowForm(true)}>New job opening</button>} />
      )}
      {!loading && openings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <p className="font-display font-bold text-ink">Job openings ledger</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Positions</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {openings.map((o) => (
                <tr key={o._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{o.title}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{o.departmentId?.name || '-'}</td>
                  <td className="px-4 py-2.5 num">{o.numberOfPositions}</td>
                  <td className="px-4 py-2.5"><span className={o.status === 'open' ? 'chip-accent' : o.status === 'on_hold' ? 'chip-warning' : 'chip-danger'}>{o.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button className="btn-ghost !text-accent" onClick={() => onViewCandidates(o)}>Candidates</button>
                      {o.status !== 'closed' && <button className="btn-ghost !text-danger" onClick={() => close(o._id)}>Close</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <JobOpeningForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function JobOpeningForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ title: '', branchId: '', description: '', numberOfPositions: '1' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/recruitment/job-openings', {
        title: form.title, branchId: form.branchId || undefined,
        description: form.description, numberOfPositions: Number(form.numberOfPositions) || 1,
      });
      toast('Job opening created.', 'success');
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
        <p className="font-display text-lg mb-4">New job opening</p>
        <div className="space-y-3">
          <div><label className="field-label">Title</label><input required autoFocus className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Cashier" /></div>
          <div>
            <label className="field-label">Branch</label>
            <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Unassigned</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Number of positions</label><input type="number" min="1" className="field-input num" value={form.numberOfPositions} onChange={(e) => setForm({ ...form, numberOfPositions: e.target.value })} /></div>
          <div><label className="field-label">Description</label><textarea className="field-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

// --- Candidates --------------------------------------------------------------

function CandidatesTab({ initialOpening }) {
  const toast = useToast();
  const [openings, setOpenings] = useState([]);
  const [openingFilter, setOpeningFilter] = useState(initialOpening?._id || '');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => { api.get('/recruitment/job-openings').then(setOpenings).catch(() => {}); }, []);

  function load() {
    setLoading(true);
    const query = openingFilter ? `?jobOpeningId=${openingFilter}` : '';
    api.get(`/recruitment/candidates${query}`).then(setCandidates).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [openingFilter]);

  const byStage = STAGES.reduce((acc, s) => { acc[s] = candidates.filter((c) => c.stage === s); return acc; }, {});

  return (
    <div>
      <div className="flex justify-between items-center mb-3 gap-2">
        <select className="field-input max-w-xs" value={openingFilter} onChange={(e) => setOpeningFilter(e.target.value)}>
          <option value="">All job openings</option>
          {openings.map((o) => <option key={o._id} value={o._id}>{o.title}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowForm(true)} disabled={openings.length === 0}>Add candidate</button>
      </div>

      {loading && <Loading />}
      {!loading && candidates.length === 0 && <EmptyState title="No candidates yet" description="Add a candidate against a job opening to start the pipeline." />}
      {!loading && candidates.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-2">
            {STAGES.map((stage) => (
              <div key={stage} className="w-60 shrink-0 bg-surface-sunken rounded-xl p-2.5">
                <p className="eyebrow mb-2 px-1 flex items-baseline gap-1.5">
                  {STAGE_LABELS[stage]} <span className="text-ink-muted normal-case tracking-normal font-medium">({byStage[stage].length})</span>
                </p>
                <div className="space-y-2">
                  {byStage[stage].map((c) => (
                    <button key={c._id} onClick={() => setSelected(c)} className="w-full text-left card p-3 hover:border-accent transition-colors">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{c.jobOpeningId?.title}</p>
                    </button>
                  ))}
                  {byStage[stage].length === 0 && <p className="text-xs text-ink-muted px-1 py-2">No candidates here.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && <CandidateForm openings={openings} defaultOpeningId={openingFilter} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {selected && <CandidateDetail candidateId={selected._id} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function CandidateForm({ openings, defaultOpeningId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ jobOpeningId: defaultOpeningId || '', name: '', email: '', phone: '', resumeNote: '', source: 'direct' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/recruitment/candidates', form);
      toast('Candidate added.', 'success');
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
        <p className="font-display text-lg mb-4">Add candidate</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Job opening</label>
            <select required className="field-input" value={form.jobOpeningId} onChange={(e) => setForm({ ...form, jobOpeningId: e.target.value })}>
              <option value="">Select…</option>
              {openings.map((o) => <option key={o._id} value={o._id}>{o.title}</option>)}
            </select>
          </div>
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Email</label><input type="email" className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="field-label">Phone</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div>
            <label className="field-label">Source</label>
            <select className="field-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="direct">Direct</option>
              <option value="referral">Referral</option>
              <option value="job_board">Job board</option>
              <option value="agency">Agency</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div><label className="field-label">Resume note</label><input className="field-input" placeholder="e.g. see Recruitment drive, JaneDoe-CV.pdf" value={form.resumeNote} onChange={(e) => setForm({ ...form, resumeNote: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function CandidateDetail({ candidateId, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showHire, setShowHire] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  function load() {
    api.get(`/recruitment/candidates/${candidateId}`).then(setData).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [candidateId]);

  async function advance() {
    const next = NEXT_STAGE[data.candidate.stage];
    if (!next) return;
    try {
      await api.post(`/recruitment/candidates/${candidateId}/move-stage`, { stage: next });
      toast(`Moved to ${STAGE_LABELS[next]}.`, 'success');
      load(); onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function reject() {
    try {
      await api.post(`/recruitment/candidates/${candidateId}/move-stage`, { stage: 'rejected', rejectionReason: rejectReason });
      toast('Candidate rejected.', 'success');
      setShowReject(false);
      load(); onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (!data) return null;
  const { candidate, interviews } = data;
  const nextStage = NEXT_STAGE[candidate.stage];
  const canHire = candidate.stage === 'offer' && !candidate.employeeId;
  const isTerminal = candidate.stage === 'hired' || candidate.stage === 'rejected';

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="font-display text-lg">{candidate.name}</p>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
        </div>
        <p className="text-sm text-ink-muted mb-1">{candidate.jobOpeningId?.title}</p>
        <p className="text-sm mb-3">
          <span className={candidate.stage === 'hired' ? 'chip-accent' : candidate.stage === 'rejected' ? 'chip-danger' : 'chip-neutral'}>{STAGE_LABELS[candidate.stage]}</span>
        </p>

        <div className="text-sm space-y-1 mb-4">
          {candidate.email && <p><span className="text-ink-muted">Email: </span>{candidate.email}</p>}
          {candidate.phone && <p><span className="text-ink-muted">Phone: </span>{candidate.phone}</p>}
          {candidate.resumeNote && <p><span className="text-ink-muted">Resume: </span>{candidate.resumeNote}</p>}
          {candidate.rejectionReason && <p><span className="text-ink-muted">Rejection reason: </span>{candidate.rejectionReason}</p>}
        </div>

        {!isTerminal && (
          <div className="flex flex-wrap gap-2 mb-4">
            {nextStage && <button className="btn-secondary" onClick={advance}>Move to {STAGE_LABELS[nextStage]}</button>}
            <button className="btn-secondary" onClick={() => setShowSchedule(true)}>Schedule interview</button>
            {canHire && <button className="btn-primary" onClick={() => setShowHire(true)}>Hire</button>}
            <button className="btn-ghost !text-danger" onClick={() => setShowReject(true)}>Reject</button>
          </div>
        )}

        {showReject && (
          <div className="mb-4 p-3 border border-rule rounded">
            <label className="field-label">Rejection reason</label>
            <input className="field-input mb-2" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setShowReject(false)}>Cancel</button>
              <button className="btn-primary" disabled={!rejectReason} onClick={reject}>Confirm reject</button>
            </div>
          </div>
        )}

        <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">Interviews</p>
        {interviews.length === 0 && <p className="text-sm text-ink-muted mb-2">No interviews scheduled.</p>}
        <div className="space-y-2 mb-2">
          {interviews.map((i) => (
            <InterviewRow key={i._id} interview={i} onChanged={load} />
          ))}
        </div>

        {showSchedule && <ScheduleInterviewForm candidateId={candidateId} onClose={() => setShowSchedule(false)} onSaved={() => { setShowSchedule(false); load(); }} />}
        {showHire && <HireForm candidateId={candidateId} onClose={() => setShowHire(false)} onSaved={() => { setShowHire(false); load(); onChanged(); }} />}
      </div>
    </div>
  );
}

function InterviewRow({ interview, onChanged }) {
  const toast = useToast();
  const [feedback, setFeedback] = useState(interview.feedback || '');
  const [rating, setRating] = useState(interview.rating || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.post(`/recruitment/interviews/${interview._id}/feedback`, { feedback, rating: rating ? Number(rating) : undefined });
      toast('Feedback recorded.', 'success');
      setEditing(false);
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="border border-rule rounded p-2 text-sm">
      <div className="flex justify-between">
        <span>{formatDate(interview.scheduledAt)} · <span className="capitalize">{interview.mode.replace('_', ' ')}</span></span>
        {interview.completedAt ? <span className="chip-accent">Done{interview.rating ? ` · ${interview.rating}/5` : ''}</span> : <span className="chip-warning">Pending</span>}
      </div>
      {interview.feedback && !editing && <p className="text-ink-muted mt-1">{interview.feedback}</p>}
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea className="field-input" rows={2} placeholder="Feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <select className="field-input" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">No rating</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost !text-accent mt-1" onClick={() => setEditing(true)}>Add feedback</button>
      )}
    </div>
  );
}

function ScheduleInterviewForm({ candidateId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ scheduledAt: '', mode: 'in_person' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/recruitment/interviews', { candidateId, scheduledAt: form.scheduledAt, mode: form.mode });
      toast('Interview scheduled.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 p-3 border border-rule rounded">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div><label className="field-label">Date &amp; time</label><input required type="datetime-local" className="field-input" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
        <div>
          <label className="field-label">Mode</label>
          <select className="field-input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            <option value="in_person">In person</option>
            <option value="phone">Phone</option>
            <option value="video">Video</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Schedule'}</button>
        </div>
      </form>
    </div>
  );
}

function HireForm({ candidateId, onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ designation: '', branchId: '', basic: '', allowances: '', deductions: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/recruitment/candidates/${candidateId}/hire`, {
        designation: form.designation, branchId: form.branchId || undefined,
        salaryStructure: { basic: Number(form.basic) || 0, allowances: Number(form.allowances) || 0, deductions: Number(form.deductions) || 0 },
      });
      toast('Candidate hired: employee record created.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 p-3 border border-rule rounded">
      <p className="text-sm font-medium mb-2">Hire: create employee record</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div><label className="field-label">Designation</label><input className="field-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
        <div>
          <label className="field-label">Branch</label>
          <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">Unassigned</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="field-label">Basic</label><input type="number" className="field-input num" value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} /></div>
          <div><label className="field-label">Allowances</label><input type="number" className="field-input num" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} /></div>
          <div><label className="field-label">Deductions</label><input type="number" className="field-input num" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Hiring…' : 'Confirm hire'}</button>
        </div>
      </form>
    </div>
  );
}

// --- Pipeline summary --------------------------------------------------------

function PipelineTab() {
  const toast = useToast();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get('/recruitment/pipeline-summary').then(setSummary).catch((err) => toast(err.message, 'error'));
  }, []);

  if (!summary) return <Loading />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {STAGES.map((stage) => (
        <div key={stage} className="card p-4 text-center">
          <p className="text-2xl font-display font-bold num text-ink">{summary[stage] || 0}</p>
          <p className="eyebrow mt-1.5">{STAGE_LABELS[stage]}</p>
        </div>
      ))}
    </div>
  );
}
