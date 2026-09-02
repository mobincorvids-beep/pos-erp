import { useEffect, useState } from 'react';
import { Plus, Trash2, Users2, Play, Pause, ArrowUp, ArrowDown, Mail, MessageSquare, Clock3 } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

const CONDITION_FIELDS = [
  { value: 'tags', label: 'Tag', operators: [{ value: 'contains', label: 'is' }], valueType: 'text' },
  { value: 'totalSpend', label: 'Total spend', operators: [{ value: 'gte', label: 'at least' }, { value: 'lte', label: 'at most' }], valueType: 'number' },
  { value: 'lastPurchaseDate', label: 'Last purchase', operators: [{ value: 'after', label: 'on/after' }, { value: 'before', label: 'before' }], valueType: 'date' },
  { value: 'loyaltyTier', label: 'Loyalty tier', operators: [{ value: 'equals', label: 'is' }], valueType: 'tier' },
];
const TIER_OPTIONS = ['none', 'bronze', 'silver', 'gold'];
const STEP_TYPES = [
  { value: 'send_email', label: 'Send email', icon: Mail },
  { value: 'send_sms', label: 'Send SMS', icon: MessageSquare },
  { value: 'wait', label: 'Wait', icon: Clock3 },
];

function fieldMeta(field) {
  return CONDITION_FIELDS.find((f) => f.value === field) || CONDITION_FIELDS[0];
}

export function MarketingAutomationPage() {
  const [tab, setTab] = useState('journeys');

  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">Marketing</p>
        <p className="page-title">Marketing Automation</p>
        <p className="text-sm text-ink-muted mt-1">Build audience segments, then automate multi-step email/SMS journeys that enroll customers and send on a schedule.</p>
      </div>

      <div className="flex gap-2 mb-4 border-b border-rule">
        {[['journeys', 'Journeys'], ['segments', 'Segments']].map(([key, label]) => (
          <button
            key={key}
            className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === key ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'segments' ? <SegmentsTab /> : <JourneysTab />}
    </div>
  );
}

// ============================================================= Segments ===

function SegmentsTab() {
  const [segments, setSegments] = useState(null);
  const [editing, setEditing] = useState(null); // segment object or 'new'
  const toast = useToast();

  async function load() {
    try {
      setSegments(await api.get('/marketing/segments'));
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  useEffect(() => { load(); }, []);

  if (editing) {
    return <SegmentEditor segment={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> New segment</button>
      </div>
      {segments === null ? (
        <Loading />
      ) : segments.length === 0 ? (
        <EmptyState
          title="No segments yet"
          description="Segments filter your customers by tag, spend, last purchase, or loyalty tier — build one, then target it with a journey."
          action={<button className="btn-primary" onClick={() => setEditing('new')}>Create your first segment</button>}
        />
      ) : (
        <div className="grid gap-3">
          {segments.map((s) => (
            <SegmentRow key={s._id} segment={s} onEdit={() => setEditing(s)} onChanged={load} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}

function SegmentRow({ segment, onEdit, onChanged, toast }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    api.get(`/marketing/segments/${segment._id}/preview`).then((r) => setCount(r.count)).catch(() => setCount(null));
  }, [segment._id]);

  async function remove() {
    if (!window.confirm(`Delete segment "${segment.name}"?`)) return;
    try {
      await api.del(`/marketing/segments/${segment._id}`);
      toast('Segment deleted.', 'success');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <button className="font-display font-bold text-ink hover:text-accent transition-colors" onClick={onEdit}>{segment.name}</button>
        <p className="text-xs text-ink-muted mt-1">{segment.description || `${segment.conditions.length} condition${segment.conditions.length === 1 ? '' : 's'}`}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-ink-muted flex items-center gap-1"><Users2 size={13} /> {count === null ? '…' : count} member{count === 1 ? '' : 's'}</span>
        <button className="text-danger hover:opacity-70" onClick={remove}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function SegmentEditor({ segment, onClose, onSaved }) {
  const isNew = !segment;
  const [name, setName] = useState(segment?.name || '');
  const [description, setDescription] = useState(segment?.description || '');
  const [conditions, setConditions] = useState(segment?.conditions?.length ? segment.conditions : []);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  function addCondition() {
    setConditions((c) => [...c, { field: 'tags', operator: 'contains', value: '' }]);
  }
  function updateCondition(idx, patch) {
    setConditions((c) => c.map((cond, i) => {
      if (i !== idx) return cond;
      const next = { ...cond, ...patch };
      // Reset operator/value if the field type changed to something incompatible.
      if (patch.field && patch.field !== cond.field) {
        next.operator = fieldMeta(patch.field).operators[0].value;
        next.value = '';
      }
      return next;
    }));
  }
  function removeCondition(idx) {
    setConditions((c) => c.filter((_, i) => i !== idx));
  }

  async function previewLive() {
    if (isNew) {
      toast('Save the segment first to preview live membership.', 'error');
      return;
    }
    try {
      await api.put(`/marketing/segments/${segment._id}`, { name, description, conditions });
      setPreview(await api.get(`/marketing/segments/${segment._id}/preview`));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function save() {
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/marketing/segments', { name, description, conditions });
        toast('Segment created.', 'success');
      } else {
        await api.put(`/marketing/segments/${segment._id}`, { name, description, conditions });
        toast('Segment saved.', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="eyebrow mb-1">Segments</p>
          <p className="page-title">{isNew ? 'New segment' : `Edit: ${segment.name}`}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <div className="card p-5 grid gap-4">
        <div>
          <label className="field-label">Name</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="High-value VIPs" />
        </div>
        <div>
          <label className="field-label">Description (optional)</label>
          <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Customers tagged VIP who spent 10k+" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="field-label mb-0">Conditions (all must match)</label>
            <button className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-strong" onClick={addCondition}><Plus size={13} /> Add condition</button>
          </div>
          {conditions.length === 0 && <p className="text-xs text-ink-muted">No conditions — this segment includes every customer.</p>}
          <div className="grid gap-2">
            {conditions.map((cond, idx) => {
              const meta = fieldMeta(cond.field);
              return (
                <div key={idx} className="flex items-center gap-2 bg-surface-sunken border border-rule rounded-lg p-2 flex-wrap">
                  <select className="field-input" value={cond.field} onChange={(e) => updateCondition(idx, { field: e.target.value })}>
                    {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select className="field-input" value={cond.operator} onChange={(e) => updateCondition(idx, { operator: e.target.value })}>
                    {meta.operators.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {meta.valueType === 'tier' ? (
                    <select className="field-input flex-1" value={cond.value} onChange={(e) => updateCondition(idx, { value: e.target.value })}>
                      {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input
                      className="field-input flex-1"
                      type={meta.valueType === 'number' ? 'number' : meta.valueType === 'date' ? 'date' : 'text'}
                      value={cond.value}
                      onChange={(e) => updateCondition(idx, { value: e.target.value })}
                      placeholder={meta.valueType === 'text' ? 'VIP' : ''}
                    />
                  )}
                  <button className="text-danger hover:opacity-70" onClick={() => removeCondition(idx)}><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-rule">
          <button className="btn-secondary" onClick={previewLive}><Users2 size={14} /> Preview live member count</button>
          {preview !== null && <p className="text-sm text-ink mt-2 num">{preview.count} matching customer{preview.count === 1 ? '' : 's'}</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================== Journeys ===

function JourneysTab() {
  const [journeys, setJourneys] = useState(null);
  const [segments, setSegments] = useState([]);
  const [editing, setEditing] = useState(null); // journey object or 'new'
  const toast = useToast();

  async function load() {
    try {
      const [j, s] = await Promise.all([api.get('/marketing/journeys'), api.get('/marketing/segments')]);
      setJourneys(j);
      setSegments(s);
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  useEffect(() => { load(); }, []);

  if (editing) {
    return (
      <JourneyEditor
        journey={editing === 'new' ? null : editing}
        segments={segments}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> New journey</button>
      </div>
      {journeys === null ? (
        <Loading />
      ) : journeys.length === 0 ? (
        <EmptyState
          title="No journeys yet"
          description="A journey is an ordered sequence of send/wait steps that automatically walks enrolled customers through — a welcome email, then a wait, then a follow-up SMS, for example."
          action={<button className="btn-primary" onClick={() => setEditing('new')}>Create your first journey</button>}
        />
      ) : (
        <div className="grid gap-3">
          {journeys.map((j) => (
            <JourneyRow key={j._id} journey={j} segments={segments} onEdit={() => setEditing(j)} onChanged={load} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}

function JourneyRow({ journey, segments, onEdit, onChanged, toast }) {
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const segment = segments.find((s) => String(s._id) === String(journey.trigger?.segmentId));

  async function toggleStats() {
    if (!showStats && !stats) {
      try {
        setStats(await api.get(`/marketing/journeys/${journey._id}/stats`));
      } catch (err) {
        toast(err.message, 'error');
        return;
      }
    }
    setShowStats((s) => !s);
  }

  async function toggleActive() {
    try {
      if (journey.status === 'active') {
        await api.post(`/marketing/journeys/${journey._id}/pause`);
        toast('Journey paused.', 'success');
      } else {
        await api.post(`/marketing/journeys/${journey._id}/start`);
        toast('Journey started.', 'success');
      }
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function enrollNow() {
    if (!journey.trigger?.segmentId) {
      toast('This journey has no trigger segment to enroll from.', 'error');
      return;
    }
    try {
      const result = await api.post(`/marketing/journeys/${journey._id}/enroll-segment`, { segmentId: journey.trigger.segmentId });
      toast(`Enrolled ${result.enrolledCount} of ${result.totalMembers} segment member(s).`, 'success');
      setStats(null);
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button className="font-display font-bold text-ink hover:text-accent transition-colors" onClick={onEdit}>{journey.name}</button>
          <p className="text-xs text-ink-muted mt-1 flex items-center gap-2 flex-wrap">
            <span className={journey.status === 'active' ? 'chip-accent' : 'chip-neutral'}>{journey.status}</span>
            {journey.steps.length} step{journey.steps.length === 1 ? '' : 's'}
            {segment && <span>· triggered by segment "{segment.name}"</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button className="text-xs text-ink-muted font-semibold hover:text-ink" onClick={toggleStats}>Stats</button>
          {journey.trigger?.segmentId && (
            <button className="text-xs text-accent font-semibold hover:text-accent-strong" onClick={enrollNow}>Enroll segment now</button>
          )}
          <button className="btn-secondary !px-2.5 !py-1.5 text-xs flex items-center gap-1" onClick={toggleActive}>
            {journey.status === 'active' ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Start</>}
          </button>
        </div>
      </div>

      {showStats && stats && (
        <div className="mt-3 pt-3 border-t border-rule grid grid-cols-3 gap-3">
          <div>
            <p className="eyebrow mb-1">Total enrolled</p>
            <p className="font-display font-bold num text-ink">{stats.totalEnrolled}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Active</p>
            <p className="font-display font-bold num text-ink">{stats.active}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Completed</p>
            <p className="font-display font-bold num text-ink">{stats.completed}</p>
          </div>
          {stats.activeByStepIndex.length > 0 && (
            <div className="col-span-3 flex flex-wrap gap-2 mt-1">
              {stats.activeByStepIndex.map(({ stepIndex, count }) => (
                <span key={stepIndex} className="chip-neutral">Step {stepIndex + 1}: {count}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function emptyStep(type = 'send_email') {
  return { stepType: type, delayHours: 0, templateSubject: '', templateBody: '' };
}

function JourneyEditor({ journey, segments, onClose, onSaved }) {
  const isNew = !journey;
  const [name, setName] = useState(journey?.name || '');
  const [triggerType, setTriggerType] = useState(journey?.trigger?.type || 'manual');
  const [segmentId, setSegmentId] = useState(journey?.trigger?.segmentId || '');
  const [steps, setSteps] = useState(journey?.steps?.length ? journey.steps : [emptyStep()]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  function updateStep(idx, patch) {
    setSteps((s) => s.map((step, i) => (i === idx ? { ...step, ...patch } : step)));
  }
  function addStep() {
    setSteps((s) => [...s, emptyStep()]);
  }
  function removeStep(idx) {
    setSteps((s) => s.filter((_, i) => i !== idx));
  }
  function moveStep(idx, dir) {
    setSteps((s) => {
      const next = [...s];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return s;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name,
        trigger: { type: triggerType, segmentId: triggerType === 'segment_entry' ? (segmentId || null) : null },
        steps: steps.map((s) => ({
          stepType: s.stepType,
          delayHours: Number(s.delayHours) || 0,
          templateSubject: s.templateSubject || '',
          templateBody: s.templateBody || '',
        })),
      };
      if (isNew) {
        await api.post('/marketing/journeys', payload);
        toast('Journey created.', 'success');
      } else {
        await api.put(`/marketing/journeys/${journey._id}`, payload);
        toast('Journey saved.', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="eyebrow mb-1">Journeys</p>
          <p className="page-title">{isNew ? 'New journey' : `Edit: ${journey.name}`}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving || !name.trim() || !steps.length}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <div className="card p-5 grid gap-4">
        <div>
          <label className="field-label">Name</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VIP Welcome Drip" />
        </div>

        <div>
          <label className="field-label">Trigger</label>
          <div className="flex gap-2 items-center flex-wrap">
            <select className="field-input" value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
              <option value="manual">Manual (vendor starts it against a chosen segment)</option>
              <option value="segment_entry">Segment entry (enroll a segment's current members on Start)</option>
            </select>
            {triggerType === 'segment_entry' && (
              <select className="field-input" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                <option value="">Choose a segment…</option>
                {segments.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-1">Regardless of trigger, you can always manually enroll a segment's members from the journey list once it's saved.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="field-label mb-0">Steps (in order)</label>
            <button className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-strong" onClick={addStep}><Plus size={13} /> Add step</button>
          </div>
          <div className="grid gap-2">
            {steps.map((step, idx) => (
              <div key={idx} className="bg-surface-sunken border border-rule rounded-lg p-3 grid gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-ink-muted w-5">{idx + 1}.</span>
                  <select className="field-input" value={step.stepType} onChange={(e) => updateStep(idx, { stepType: e.target.value })}>
                    {STEP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <label className="text-xs text-ink-muted flex items-center gap-1">
                    Wait
                    <input className="field-input !w-20" type="number" min="0" value={step.delayHours}
                      onChange={(e) => updateStep(idx, { delayHours: e.target.value })} />
                    hours{step.stepType === 'wait' ? ' then continue' : ' before sending'}
                  </label>
                  <div className="flex items-center gap-1 ml-auto">
                    <button className="text-ink-muted hover:text-ink disabled:opacity-30" disabled={idx === 0} onClick={() => moveStep(idx, -1)}><ArrowUp size={14} /></button>
                    <button className="text-ink-muted hover:text-ink disabled:opacity-30" disabled={idx === steps.length - 1} onClick={() => moveStep(idx, 1)}><ArrowDown size={14} /></button>
                    <button className="text-danger hover:opacity-70" onClick={() => removeStep(idx)}><Trash2 size={15} /></button>
                  </div>
                </div>
                {step.stepType === 'send_email' && (
                  <input className="field-input" placeholder="Subject — supports {{customerName}}"
                    value={step.templateSubject} onChange={(e) => updateStep(idx, { templateSubject: e.target.value })} />
                )}
                {(step.stepType === 'send_email' || step.stepType === 'send_sms') && (
                  <textarea className="field-input" rows={2} placeholder="Message — supports {{customerName}}, {{customerEmail}}, {{customerPhone}}, {{companyName}}"
                    value={step.templateBody} onChange={(e) => updateStep(idx, { templateBody: e.target.value })} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
