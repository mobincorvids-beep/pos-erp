import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
const NEXT_STAGE = { applied: 'screening', screening: 'interview', interview: 'offer' };

export function RecruitmentPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('openings');
  const [selectedOpening, setSelectedOpening] = useState(null); // job opening to scope the candidates tab to, or null for "all"

  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">{t('recruitment.eyebrow')}</p>
        <p className="page-title">{t('recruitment.title')}</p>
        <p className="text-sm text-ink-muted mt-1">{t('recruitment.subtitle')}</p>
      </div>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['openings', t('recruitment.jobOpenings')], ['candidates', t('recruitment.candidates')], ['pipeline', t('recruitment.pipeline')]].map(([key, label]) => (
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
  const { t } = useTranslation();
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
      toast(t('recruitment.jobOpeningClosed'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('recruitment.newJobOpening')}</button>
      </div>

      {loading && <Loading />}
      {!loading && openings.length === 0 && (
        <EmptyState title={t('recruitment.noJobOpeningsYet')} description={t('recruitment.noJobOpeningsDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('recruitment.newJobOpening')}</button>} />
      )}
      {!loading && openings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <p className="font-display font-bold text-ink">{t('recruitment.jobOpeningsLedger')}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-4 py-2.5 font-medium">{t('recruitment.titleColumn')}</th>
                <th className="px-4 py-2.5 font-medium">{t('recruitment.department')}</th>
                <th className="px-4 py-2.5 font-medium">{t('recruitment.positions')}</th>
                <th className="px-4 py-2.5 font-medium">{t('recruitment.status')}</th>
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
                      <button className="btn-ghost !text-accent" onClick={() => onViewCandidates(o)}>{t('recruitment.candidates')}</button>
                      {o.status !== 'closed' && <button className="btn-ghost !text-danger" onClick={() => close(o._id)}>{t('recruitment.closeAction')}</button>}
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
  const { t } = useTranslation();
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
      toast(t('recruitment.jobOpeningCreated'), 'success');
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
        <p className="font-display text-lg mb-4">{t('recruitment.newJobOpening')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('recruitment.titleColumn')}</label><input required autoFocus className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('recruitment.titlePlaceholder')} /></div>
          <div>
            <label className="field-label">{t('recruitment.branch')}</label>
            <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('recruitment.unassigned')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">{t('recruitment.numberOfPositions')}</label><input type="number" min="1" className="field-input num" value={form.numberOfPositions} onChange={(e) => setForm({ ...form, numberOfPositions: e.target.value })} /></div>
          <div><label className="field-label">{t('recruitment.description')}</label><textarea className="field-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('recruitment.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('recruitment.saving') : t('recruitment.save')}</button>
        </div>
      </form>
    </div>
  );
}

// --- Candidates --------------------------------------------------------------

function CandidatesTab({ initialOpening }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [openings, setOpenings] = useState([]);
  const [openingFilter, setOpeningFilter] = useState(initialOpening?._id || '');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  const STAGE_LABELS = { applied: t('recruitment.stageApplied'), screening: t('recruitment.stageScreening'), interview: t('recruitment.stageInterview'), offer: t('recruitment.stageOffer'), hired: t('recruitment.stageHired'), rejected: t('recruitment.stageRejected') };

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
          <option value="">{t('recruitment.allJobOpenings')}</option>
          {openings.map((o) => <option key={o._id} value={o._id}>{o.title}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowForm(true)} disabled={openings.length === 0}>{t('recruitment.addCandidate')}</button>
      </div>

      {loading && <Loading />}
      {!loading && candidates.length === 0 && <EmptyState title={t('recruitment.noCandidatesYet')} description={t('recruitment.noCandidatesDescription')} />}
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
                  {byStage[stage].length === 0 && <p className="text-xs text-ink-muted px-1 py-2">{t('recruitment.noCandidatesHere')}</p>}
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
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ jobOpeningId: defaultOpeningId || '', name: '', email: '', phone: '', resumeNote: '', source: 'direct' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/recruitment/candidates', form);
      toast(t('recruitment.candidateAdded'), 'success');
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
        <p className="font-display text-lg mb-4">{t('recruitment.addCandidate')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('recruitment.jobOpening')}</label>
            <select required className="field-input" value={form.jobOpeningId} onChange={(e) => setForm({ ...form, jobOpeningId: e.target.value })}>
              <option value="">{t('recruitment.select')}</option>
              {openings.map((o) => <option key={o._id} value={o._id}>{o.title}</option>)}
            </select>
          </div>
          <div><label className="field-label">{t('recruitment.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">{t('recruitment.email')}</label><input type="email" className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="field-label">{t('recruitment.phone')}</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div>
            <label className="field-label">{t('recruitment.source')}</label>
            <select className="field-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="direct">{t('recruitment.sourceDirect')}</option>
              <option value="referral">{t('recruitment.sourceReferral')}</option>
              <option value="job_board">{t('recruitment.sourceJobBoard')}</option>
              <option value="agency">{t('recruitment.sourceAgency')}</option>
              <option value="other">{t('recruitment.sourceOther')}</option>
            </select>
          </div>
          <div><label className="field-label">{t('recruitment.resumeNote')}</label><input className="field-input" placeholder={t('recruitment.resumeNotePlaceholder')} value={form.resumeNote} onChange={(e) => setForm({ ...form, resumeNote: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('recruitment.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('recruitment.saving') : t('recruitment.save')}</button>
        </div>
      </form>
    </div>
  );
}

function CandidateDetail({ candidateId, onClose, onChanged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showHire, setShowHire] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const STAGE_LABELS = { applied: t('recruitment.stageApplied'), screening: t('recruitment.stageScreening'), interview: t('recruitment.stageInterview'), offer: t('recruitment.stageOffer'), hired: t('recruitment.stageHired'), rejected: t('recruitment.stageRejected') };

  function load() {
    api.get(`/recruitment/candidates/${candidateId}`).then(setData).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [candidateId]);

  async function advance() {
    const next = NEXT_STAGE[data.candidate.stage];
    if (!next) return;
    try {
      await api.post(`/recruitment/candidates/${candidateId}/move-stage`, { stage: next });
      toast(t('recruitment.movedToStage', { stage: STAGE_LABELS[next] }), 'success');
      load(); onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function reject() {
    try {
      await api.post(`/recruitment/candidates/${candidateId}/move-stage`, { stage: 'rejected', rejectionReason: rejectReason });
      toast(t('recruitment.candidateRejected'), 'success');
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
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('recruitment.close')}</button>
        </div>
        <p className="text-sm text-ink-muted mb-1">{candidate.jobOpeningId?.title}</p>
        <p className="text-sm mb-3">
          <span className={candidate.stage === 'hired' ? 'chip-accent' : candidate.stage === 'rejected' ? 'chip-danger' : 'chip-neutral'}>{STAGE_LABELS[candidate.stage]}</span>
        </p>

        <div className="text-sm space-y-1 mb-4">
          {candidate.email && <p><span className="text-ink-muted">{t('recruitment.emailLabel')}: </span>{candidate.email}</p>}
          {candidate.phone && <p><span className="text-ink-muted">{t('recruitment.phoneLabel')}: </span>{candidate.phone}</p>}
          {candidate.resumeNote && <p><span className="text-ink-muted">{t('recruitment.resumeLabel')}: </span>{candidate.resumeNote}</p>}
          {candidate.rejectionReason && <p><span className="text-ink-muted">{t('recruitment.rejectionReasonLabel')}: </span>{candidate.rejectionReason}</p>}
        </div>

        {!isTerminal && (
          <div className="flex flex-wrap gap-2 mb-4">
            {nextStage && <button className="btn-secondary" onClick={advance}>{t('recruitment.moveToStage', { stage: STAGE_LABELS[nextStage] })}</button>}
            <button className="btn-secondary" onClick={() => setShowSchedule(true)}>{t('recruitment.scheduleInterview')}</button>
            {canHire && <button className="btn-primary" onClick={() => setShowHire(true)}>{t('recruitment.hire')}</button>}
            <button className="btn-ghost !text-danger" onClick={() => setShowReject(true)}>{t('recruitment.reject')}</button>
          </div>
        )}

        {showReject && (
          <div className="mb-4 p-3 border border-rule rounded">
            <label className="field-label">{t('recruitment.rejectionReason')}</label>
            <input className="field-input mb-2" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setShowReject(false)}>{t('recruitment.cancel')}</button>
              <button className="btn-primary" disabled={!rejectReason} onClick={reject}>{t('recruitment.confirmReject')}</button>
            </div>
          </div>
        )}

        <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">{t('recruitment.interviews')}</p>
        {interviews.length === 0 && <p className="text-sm text-ink-muted mb-2">{t('recruitment.noInterviewsScheduled')}</p>}
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
  const { t } = useTranslation();
  const toast = useToast();
  const [feedback, setFeedback] = useState(interview.feedback || '');
  const [rating, setRating] = useState(interview.rating || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.post(`/recruitment/interviews/${interview._id}/feedback`, { feedback, rating: rating ? Number(rating) : undefined });
      toast(t('recruitment.feedbackRecorded'), 'success');
      setEditing(false);
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="border border-rule rounded p-2 text-sm">
      <div className="flex justify-between">
        <span>{formatDate(interview.scheduledAt)} · <span className="capitalize">{interview.mode.replace('_', ' ')}</span></span>
        {interview.completedAt ? <span className="chip-accent">{t('recruitment.done')}{interview.rating ? ` · ${interview.rating}/5` : ''}</span> : <span className="chip-warning">{t('recruitment.pending')}</span>}
      </div>
      {interview.feedback && !editing && <p className="text-ink-muted mt-1">{interview.feedback}</p>}
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea className="field-input" rows={2} placeholder={t('recruitment.feedback')} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <select className="field-input" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">{t('recruitment.noRating')}</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setEditing(false)}>{t('recruitment.cancel')}</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? t('recruitment.saving') : t('recruitment.save')}</button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost !text-accent mt-1" onClick={() => setEditing(true)}>{t('recruitment.addFeedback')}</button>
      )}
    </div>
  );
}

function ScheduleInterviewForm({ candidateId, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ scheduledAt: '', mode: 'in_person' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/recruitment/interviews', { candidateId, scheduledAt: form.scheduledAt, mode: form.mode });
      toast(t('recruitment.interviewScheduled'), 'success');
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
        <div><label className="field-label">{t('recruitment.dateTime')}</label><input required type="datetime-local" className="field-input" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
        <div>
          <label className="field-label">{t('recruitment.mode')}</label>
          <select className="field-input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            <option value="in_person">{t('recruitment.modeInPerson')}</option>
            <option value="phone">{t('recruitment.modePhone')}</option>
            <option value="video">{t('recruitment.modeVideo')}</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('recruitment.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('recruitment.saving') : t('recruitment.schedule')}</button>
        </div>
      </form>
    </div>
  );
}

function HireForm({ candidateId, onClose, onSaved }) {
  const { t } = useTranslation();
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
      toast(t('recruitment.candidateHired'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 p-3 border border-rule rounded">
      <p className="text-sm font-medium mb-2">{t('recruitment.hireCreateEmployee')}</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div><label className="field-label">{t('recruitment.designation')}</label><input className="field-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
        <div>
          <label className="field-label">{t('recruitment.branch')}</label>
          <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            <option value="">{t('recruitment.unassigned')}</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="field-label">{t('recruitment.basic')}</label><input type="number" className="field-input num" value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} /></div>
          <div><label className="field-label">{t('recruitment.allowances')}</label><input type="number" className="field-input num" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} /></div>
          <div><label className="field-label">{t('recruitment.deductions')}</label><input type="number" className="field-input num" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('recruitment.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('recruitment.hiring') : t('recruitment.confirmHire')}</button>
        </div>
      </form>
    </div>
  );
}

// --- Pipeline summary --------------------------------------------------------

function PipelineTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [summary, setSummary] = useState(null);

  const STAGE_LABELS = { applied: t('recruitment.stageApplied'), screening: t('recruitment.stageScreening'), interview: t('recruitment.stageInterview'), offer: t('recruitment.stageOffer'), hired: t('recruitment.stageHired'), rejected: t('recruitment.stageRejected') };

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
