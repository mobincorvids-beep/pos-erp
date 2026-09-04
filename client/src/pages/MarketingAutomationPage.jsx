import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Users2, Play, Pause, ArrowUp, ArrowDown, Mail, MessageSquare, Clock3 } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

const CONDITION_FIELDS = [
  { value: 'tags', labelKey: 'marketingAutomation.fieldTag', operators: [{ value: 'contains', labelKey: 'marketingAutomation.operatorIs' }], valueType: 'text' },
  { value: 'totalSpend', labelKey: 'marketingAutomation.fieldTotalSpend', operators: [{ value: 'gte', labelKey: 'marketingAutomation.operatorAtLeast' }, { value: 'lte', labelKey: 'marketingAutomation.operatorAtMost' }], valueType: 'number' },
  { value: 'lastPurchaseDate', labelKey: 'marketingAutomation.fieldLastPurchase', operators: [{ value: 'after', labelKey: 'marketingAutomation.operatorOnAfter' }, { value: 'before', labelKey: 'marketingAutomation.operatorBefore' }], valueType: 'date' },
  { value: 'loyaltyTier', labelKey: 'marketingAutomation.fieldLoyaltyTier', operators: [{ value: 'equals', labelKey: 'marketingAutomation.operatorIs' }], valueType: 'tier' },
];
const TIER_OPTIONS = ['none', 'bronze', 'silver', 'gold'];
const STEP_TYPES = [
  { value: 'send_email', labelKey: 'marketingAutomation.stepSendEmail', icon: Mail },
  { value: 'send_sms', labelKey: 'marketingAutomation.stepSendSms', icon: MessageSquare },
  { value: 'wait', labelKey: 'marketingAutomation.stepWait', icon: Clock3 },
];

function fieldMeta(field) {
  return CONDITION_FIELDS.find((f) => f.value === field) || CONDITION_FIELDS[0];
}

export function MarketingAutomationPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('journeys');

  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">{t('marketingAutomation.marketing')}</p>
        <p className="page-title">{t('marketingAutomation.title')}</p>
        <p className="text-sm text-ink-muted mt-1">{t('marketingAutomation.subtitle')}</p>
      </div>

      <div className="flex gap-2 mb-4 border-b border-rule">
        {[['journeys', t('marketingAutomation.journeys')], ['segments', t('marketingAutomation.segments')]].map(([key, label]) => (
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
  const { t } = useTranslation();
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
        <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> {t('marketingAutomation.newSegment')}</button>
      </div>
      {segments === null ? (
        <Loading />
      ) : segments.length === 0 ? (
        <EmptyState
          title={t('marketingAutomation.noSegmentsYet')}
          description={t('marketingAutomation.noSegmentsDescription')}
          action={<button className="btn-primary" onClick={() => setEditing('new')}>{t('marketingAutomation.createFirstSegment')}</button>}
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
  const { t } = useTranslation();
  const [count, setCount] = useState(null);

  useEffect(() => {
    api.get(`/marketing/segments/${segment._id}/preview`).then((r) => setCount(r.count)).catch(() => setCount(null));
  }, [segment._id]);

  async function remove() {
    if (!window.confirm(t('marketingAutomation.deleteSegmentConfirm', { name: segment.name }))) return;
    try {
      await api.del(`/marketing/segments/${segment._id}`);
      toast(t('marketingAutomation.segmentDeleted'), 'success');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <button className="font-display font-bold text-ink hover:text-accent transition-colors" onClick={onEdit}>{segment.name}</button>
        <p className="text-xs text-ink-muted mt-1">{segment.description || t('marketingAutomation.conditionCount', { count: segment.conditions.length })}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-ink-muted flex items-center gap-1"><Users2 size={13} /> {count === null ? '…' : count} {t('marketingAutomation.membersSuffix', { count: count ?? 0 })}</span>
        <button className="text-danger hover:opacity-70" onClick={remove}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function SegmentEditor({ segment, onClose, onSaved }) {
  const { t } = useTranslation();
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
      toast(t('marketingAutomation.saveSegmentFirst'), 'error');
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
        toast(t('marketingAutomation.segmentCreated'), 'success');
      } else {
        await api.put(`/marketing/segments/${segment._id}`, { name, description, conditions });
        toast(t('marketingAutomation.segmentSaved'), 'success');
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
          <p className="eyebrow mb-1">{t('marketingAutomation.segments')}</p>
          <p className="page-title">{isNew ? t('marketingAutomation.newSegment') : t('marketingAutomation.editPrefix', { name: segment.name })}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>{t('marketingAutomation.cancel')}</button>
          <button className="btn-primary" onClick={save} disabled={saving || !name.trim()}>{saving ? t('marketingAutomation.saving') : t('marketingAutomation.save')}</button>
        </div>
      </div>

      <div className="card p-5 grid gap-4">
        <div>
          <label className="field-label">{t('marketingAutomation.name')}</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('marketingAutomation.segmentNamePlaceholder')} />
        </div>
        <div>
          <label className="field-label">{t('marketingAutomation.descriptionOptional')}</label>
          <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('marketingAutomation.segmentDescriptionPlaceholder')} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="field-label mb-0">{t('marketingAutomation.conditionsAllMustMatch')}</label>
            <button className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-strong" onClick={addCondition}><Plus size={13} /> {t('marketingAutomation.addCondition')}</button>
          </div>
          {conditions.length === 0 && <p className="text-xs text-ink-muted">{t('marketingAutomation.noConditions')}</p>}
          <div className="grid gap-2">
            {conditions.map((cond, idx) => {
              const meta = fieldMeta(cond.field);
              return (
                <div key={idx} className="flex items-center gap-2 bg-surface-sunken border border-rule rounded-lg p-2 flex-wrap">
                  <select className="field-input" value={cond.field} onChange={(e) => updateCondition(idx, { field: e.target.value })}>
                    {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{t(f.labelKey)}</option>)}
                  </select>
                  <select className="field-input" value={cond.operator} onChange={(e) => updateCondition(idx, { operator: e.target.value })}>
                    {meta.operators.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                  </select>
                  {meta.valueType === 'tier' ? (
                    <select className="field-input flex-1" value={cond.value} onChange={(e) => updateCondition(idx, { value: e.target.value })}>
                      {TIER_OPTIONS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                    </select>
                  ) : (
                    <input
                      className="field-input flex-1"
                      type={meta.valueType === 'number' ? 'number' : meta.valueType === 'date' ? 'date' : 'text'}
                      value={cond.value}
                      onChange={(e) => updateCondition(idx, { value: e.target.value })}
                      placeholder={meta.valueType === 'text' ? t('marketingAutomation.conditionValuePlaceholder') : ''}
                    />
                  )}
                  <button className="text-danger hover:opacity-70" onClick={() => removeCondition(idx)}><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-rule">
          <button className="btn-secondary" onClick={previewLive}><Users2 size={14} /> {t('marketingAutomation.previewLiveMemberCount')}</button>
          {preview !== null && <p className="text-sm text-ink mt-2 num">{t('marketingAutomation.matchingCustomerCount', { count: preview.count })}</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================== Journeys ===

function JourneysTab() {
  const { t } = useTranslation();
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
        <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> {t('marketingAutomation.newJourney')}</button>
      </div>
      {journeys === null ? (
        <Loading />
      ) : journeys.length === 0 ? (
        <EmptyState
          title={t('marketingAutomation.noJourneysYet')}
          description={t('marketingAutomation.noJourneysDescription')}
          action={<button className="btn-primary" onClick={() => setEditing('new')}>{t('marketingAutomation.createFirstJourney')}</button>}
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
  const { t } = useTranslation();
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
        toast(t('marketingAutomation.journeyPaused'), 'success');
      } else {
        await api.post(`/marketing/journeys/${journey._id}/start`);
        toast(t('marketingAutomation.journeyStarted'), 'success');
      }
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function enrollNow() {
    if (!journey.trigger?.segmentId) {
      toast(t('marketingAutomation.noTriggerSegment'), 'error');
      return;
    }
    try {
      const result = await api.post(`/marketing/journeys/${journey._id}/enroll-segment`, { segmentId: journey.trigger.segmentId });
      toast(t('marketingAutomation.enrolledSummary', { enrolled: result.enrolledCount, total: result.totalMembers }), 'success');
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
            {t('marketingAutomation.stepCount', { count: journey.steps.length })}
            {segment && <span>{t('marketingAutomation.triggeredBySegment', { name: segment.name })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button className="text-xs text-ink-muted font-semibold hover:text-ink" onClick={toggleStats}>{t('marketingAutomation.stats')}</button>
          {journey.trigger?.segmentId && (
            <button className="text-xs text-accent font-semibold hover:text-accent-strong" onClick={enrollNow}>{t('marketingAutomation.enrollSegmentNow')}</button>
          )}
          <button className="btn-secondary !px-2.5 !py-1.5 text-xs flex items-center gap-1" onClick={toggleActive}>
            {journey.status === 'active' ? <><Pause size={13} /> {t('marketingAutomation.pause')}</> : <><Play size={13} /> {t('marketingAutomation.start')}</>}
          </button>
        </div>
      </div>

      {showStats && stats && (
        <div className="mt-3 pt-3 border-t border-rule grid grid-cols-3 gap-3">
          <div>
            <p className="eyebrow mb-1">{t('marketingAutomation.totalEnrolled')}</p>
            <p className="font-display font-bold num text-ink">{stats.totalEnrolled}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">{t('marketingAutomation.active')}</p>
            <p className="font-display font-bold num text-ink">{stats.active}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">{t('marketingAutomation.completed')}</p>
            <p className="font-display font-bold num text-ink">{stats.completed}</p>
          </div>
          {stats.activeByStepIndex.length > 0 && (
            <div className="col-span-3 flex flex-wrap gap-2 mt-1">
              {stats.activeByStepIndex.map(({ stepIndex, count }) => (
                <span key={stepIndex} className="chip-neutral">{t('marketingAutomation.stepIndexCount', { index: stepIndex + 1, count })}</span>
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
  const { t } = useTranslation();
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
        toast(t('marketingAutomation.journeyCreated'), 'success');
      } else {
        await api.put(`/marketing/journeys/${journey._id}`, payload);
        toast(t('marketingAutomation.journeySaved'), 'success');
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
          <p className="eyebrow mb-1">{t('marketingAutomation.journeys')}</p>
          <p className="page-title">{isNew ? t('marketingAutomation.newJourney') : t('marketingAutomation.editPrefix', { name: journey.name })}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>{t('marketingAutomation.cancel')}</button>
          <button className="btn-primary" onClick={save} disabled={saving || !name.trim() || !steps.length}>{saving ? t('marketingAutomation.saving') : t('marketingAutomation.save')}</button>
        </div>
      </div>

      <div className="card p-5 grid gap-4">
        <div>
          <label className="field-label">{t('marketingAutomation.name')}</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('marketingAutomation.journeyNamePlaceholder')} />
        </div>

        <div>
          <label className="field-label">{t('marketingAutomation.trigger')}</label>
          <div className="flex gap-2 items-center flex-wrap">
            <select className="field-input" value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
              <option value="manual">{t('marketingAutomation.triggerManual')}</option>
              <option value="segment_entry">{t('marketingAutomation.triggerSegmentEntry')}</option>
            </select>
            {triggerType === 'segment_entry' && (
              <select className="field-input" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                <option value="">{t('marketingAutomation.chooseASegmentEllipsis')}</option>
                {segments.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-1">{t('marketingAutomation.triggerNote')}</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="field-label mb-0">{t('marketingAutomation.stepsInOrder')}</label>
            <button className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-strong" onClick={addStep}><Plus size={13} /> {t('marketingAutomation.addStep')}</button>
          </div>
          <div className="grid gap-2">
            {steps.map((step, idx) => (
              <div key={idx} className="bg-surface-sunken border border-rule rounded-lg p-3 grid gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-ink-muted w-5">{idx + 1}.</span>
                  <select className="field-input" value={step.stepType} onChange={(e) => updateStep(idx, { stepType: e.target.value })}>
                    {STEP_TYPES.map((st) => <option key={st.value} value={st.value}>{t(st.labelKey)}</option>)}
                  </select>
                  <label className="text-xs text-ink-muted flex items-center gap-1">
                    {t('marketingAutomation.wait')}
                    <input className="field-input !w-20" type="number" min="0" value={step.delayHours}
                      onChange={(e) => updateStep(idx, { delayHours: e.target.value })} />
                    {step.stepType === 'wait' ? t('marketingAutomation.hoursThenContinue') : t('marketingAutomation.hoursBeforeSending')}
                  </label>
                  <div className="flex items-center gap-1 ml-auto">
                    <button className="text-ink-muted hover:text-ink disabled:opacity-30" disabled={idx === 0} onClick={() => moveStep(idx, -1)}><ArrowUp size={14} /></button>
                    <button className="text-ink-muted hover:text-ink disabled:opacity-30" disabled={idx === steps.length - 1} onClick={() => moveStep(idx, 1)}><ArrowDown size={14} /></button>
                    <button className="text-danger hover:opacity-70" onClick={() => removeStep(idx)}><Trash2 size={15} /></button>
                  </div>
                </div>
                {step.stepType === 'send_email' && (
                  <input className="field-input" placeholder={t('marketingAutomation.subjectPlaceholder')}
                    value={step.templateSubject} onChange={(e) => updateStep(idx, { templateSubject: e.target.value })} />
                )}
                {(step.stepType === 'send_email' || step.stepType === 'send_sms') && (
                  <textarea className="field-input" rows={2} placeholder={t('marketingAutomation.messagePlaceholder')}
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
