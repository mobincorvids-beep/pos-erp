/**
 * MarketingJourneyService — CRUD for MarketingJourney plus the execution
 * engine: enrollCustomer() puts one customer at step 0 of a journey, and
 * processDueSteps() (invoked on a timer from src/server.js — see
 * src/jobs/marketingJourneyCron.js) fires every enrollment whose next
 * step is due, sending through the existing messagingService
 * (Twilio/SendGrid-or-console, same as Campaign) and advancing the
 * enrollment's pointer.
 *
 * date_based triggers are accepted by the MarketingJourney schema but NOT
 * evaluated anywhere — only segment_entry (via enrollSegmentMembers) and
 * manual (via enrollCustomer, called directly or through
 * enrollSegmentMembers) actually enroll anyone in this version. Wiring a
 * real "re-scan segment membership on a schedule and auto-enroll new
 * entrants" job is a stretch goal, not built.
 */
const MarketingJourney = require('../models/MarketingJourney');
const JourneyEnrollment = require('../models/JourneyEnrollment');
const Customer = require('../models/Customer');
const messagingService = require('./messaging/messagingService');
const audienceSegmentService = require('./audienceSegmentService');

// --- CRUD ---------------------------------------------------------------

function createJourney(input) {
  const { companyId, name, trigger, steps, userId } = input;
  if (!companyId) throw new Error('companyId is required.');
  if (!name) throw new Error('Journey name is required.');
  return MarketingJourney.create({
    companyId, name,
    trigger: trigger || { type: 'manual' },
    steps: steps || [],
    userId: userId || null,
  });
}

async function updateJourney(journeyId, companyId, updates) {
  const journey = await MarketingJourney.findOne({ _id: journeyId, companyId });
  if (!journey) throw new Error('Journey not found.');
  const { name, trigger, steps } = updates;
  if (name !== undefined) journey.name = name;
  if (trigger !== undefined) journey.trigger = trigger;
  if (steps !== undefined) journey.steps = steps;
  await journey.save();
  return journey;
}

function listJourneys(companyId) {
  return MarketingJourney.find({ companyId }).sort({ createdAt: -1 });
}

function getJourney(journeyId, companyId) {
  return MarketingJourney.findOne({ _id: journeyId, companyId });
}

async function deleteJourney(journeyId, companyId) {
  const journey = await MarketingJourney.findOne({ _id: journeyId, companyId });
  if (!journey) throw new Error('Journey not found.');
  if (journey.status === 'active') throw new Error('Pause the journey before deleting it.');
  await MarketingJourney.deleteOne({ _id: journey._id });
  await JourneyEnrollment.deleteMany({ journeyId: journey._id });
  return { ok: true };
}

async function setJourneyStatus(journeyId, companyId, status) {
  if (!['draft', 'active', 'paused'].includes(status)) throw new Error('Invalid status.');
  const journey = await MarketingJourney.findOne({ _id: journeyId, companyId });
  if (!journey) throw new Error('Journey not found.');
  if (status === 'active' && !journey.steps.length) throw new Error('Add at least one step before activating this journey.');
  journey.status = status;
  await journey.save();
  return journey;
}

// --- Enrollment -----------------------------------------------------------

/** Hours -> ms, for computing nextStepAt. */
function hoursFromNow(hours) {
  return new Date(Date.now() + Math.max(0, Number(hours) || 0) * 60 * 60 * 1000);
}

/**
 * Enrolls one customer in a journey at step 0. Idempotent against an
 * already-active enrollment (the partial unique index on
 * JourneyEnrollment would reject a duplicate insert anyway; this checks
 * first so callers get a clean no-op instead of a duplicate-key error
 * when re-enrolling a segment's members).
 */
async function enrollCustomer(journeyId, customerId, companyId) {
  const journey = companyId
    ? await MarketingJourney.findOne({ _id: journeyId, companyId })
    : await MarketingJourney.findById(journeyId);
  if (!journey) throw new Error('Journey not found.');
  if (!journey.steps.length) throw new Error('This journey has no steps.');

  const existing = await JourneyEnrollment.findOne({ journeyId: journey._id, customerId, status: 'active' });
  if (existing) return existing;

  const firstStep = journey.steps[0];
  return JourneyEnrollment.create({
    companyId: journey.companyId,
    journeyId: journey._id,
    customerId,
    currentStepIndex: 0,
    nextStepAt: hoursFromNow(firstStep.delayHours),
    status: 'active',
  });
}

/** Enrolls every current member of a segment into a journey (used both for the "manual enroll" endpoint and, for a segment_entry-trigger journey, right after activation). */
async function enrollSegmentMembers(journeyId, segmentId, companyId) {
  const members = await audienceSegmentService.resolveSegmentMembers(segmentId, companyId);
  const results = [];
  for (const customer of members) {
    try {
      results.push(await enrollCustomer(journeyId, customer._id, companyId));
    } catch (err) {
      // A single bad enrollment (e.g. race with a concurrent enroll)
      // shouldn't abort enrolling the rest of the segment.
      results.push({ customerId: customer._id, error: err.message });
    }
  }
  return { enrolledCount: results.filter((r) => !r.error).length, totalMembers: members.length };
}

function interpolate(template, customer, companyName) {
  return String(template || '')
    .replace(/\{\{\s*customerName\s*\}\}/g, customer.name || '')
    .replace(/\{\{\s*customerEmail\s*\}\}/g, customer.email || '')
    .replace(/\{\{\s*customerPhone\s*\}\}/g, customer.phone || '')
    .replace(/\{\{\s*companyName\s*\}\}/g, companyName || '');
}

/**
 * Executes the enrollment's CURRENT step, then advances the pointer to
 * the next step (or marks the enrollment complete). Returns the send
 * result (or null for a 'wait' step, which has nothing to send).
 */
async function executeStep(enrollment, journey) {
  const step = journey.steps[enrollment.currentStepIndex];
  let result = null;

  if (step.stepType === 'send_email' || step.stepType === 'send_sms') {
    const customer = await Customer.findById(enrollment.customerId);
    if (!customer) {
      result = { success: false, provider: 'none', error: 'Customer no longer exists.' };
    } else if (step.stepType === 'send_email') {
      const subject = interpolate(step.templateSubject, customer);
      const body = interpolate(step.templateBody, customer);
      result = await messagingService.sendEmail(customer.email, subject, body);
    } else {
      const body = interpolate(step.templateBody, customer);
      result = await messagingService.sendSms(customer.phone, body);
    }
  }
  // 'wait' steps produce no send — the delay itself is the step, already
  // spent by nextStepAt having elapsed.

  enrollment.history.push({
    stepIndex: enrollment.currentStepIndex,
    stepType: step.stepType,
    firedAt: new Date(),
    success: result ? result.success : true,
    provider: result ? result.provider : undefined,
    error: result ? result.error : undefined,
  });

  const nextIndex = enrollment.currentStepIndex + 1;
  if (nextIndex >= journey.steps.length) {
    enrollment.status = 'completed';
    enrollment.completedAt = new Date();
    enrollment.nextStepAt = null;
  } else {
    enrollment.currentStepIndex = nextIndex;
    enrollment.nextStepAt = hoursFromNow(journey.steps[nextIndex].delayHours);
  }

  await enrollment.save();
  return result;
}

/**
 * Finds every active enrollment whose next step is due and executes it.
 * Safe to call concurrently/repeatedly — each enrollment is atomically
 * claimed via findOneAndUpdate (advancing/marking it before the send
 * happens is NOT how this works; instead each due enrollment is fetched
 * one at a time and its nextStepAt is irrelevant to other callers once
 * executeStep's save() moves the pointer forward), and a paused/deleted
 * journey's enrollments are simply skipped (left due, picked up again
 * next run) rather than double-sent — see the journey-status check below.
 * Designed to be invoked by a single periodic timer (src/server.js), not
 * meant to be called from multiple processes at once without a
 * distributed lock; this codebase runs as a single Node process, so that
 * isn't a real risk here.
 */
async function processDueSteps(now = new Date()) {
  const due = await JourneyEnrollment.find({ status: 'active', nextStepAt: { $lte: now } }).limit(500);
  let processed = 0;
  let failed = 0;

  for (const enrollment of due) {
    const journey = await MarketingJourney.findById(enrollment.journeyId);
    if (!journey || journey.status !== 'active') continue; // paused/deleted journey — leave it due, don't advance or send

    try {
      await executeStep(enrollment, journey);
      processed++;
    } catch (err) {
      failed++;
      // Don't let one bad enrollment jam the queue forever — push
      // nextStepAt out an hour and record the failure, rather than
      // leaving it perpetually "due" and re-attempted every tick.
      enrollment.history.push({ stepIndex: enrollment.currentStepIndex, stepType: 'error', firedAt: new Date(), success: false, error: err.message });
      enrollment.nextStepAt = hoursFromNow(1);
      await enrollment.save().catch(() => {});
    }
  }

  return { scanned: due.length, processed, failed };
}

// --- Stats ----------------------------------------------------------------

async function journeyStats(journeyId, companyId) {
  const journey = await MarketingJourney.findOne({ _id: journeyId, companyId });
  if (!journey) throw new Error('Journey not found.');

  const enrollments = await JourneyEnrollment.find({ journeyId: journey._id });
  const byStep = {};
  let active = 0;
  let completed = 0;
  let cancelled = 0;
  for (const e of enrollments) {
    if (e.status === 'active') { active++; byStep[e.currentStepIndex] = (byStep[e.currentStepIndex] || 0) + 1; }
    else if (e.status === 'completed') completed++;
    else if (e.status === 'cancelled') cancelled++;
  }

  return {
    journeyId: journey._id,
    totalEnrolled: enrollments.length,
    active, completed, cancelled,
    activeByStepIndex: Object.entries(byStep).map(([stepIndex, count]) => ({ stepIndex: Number(stepIndex), count })),
  };
}

module.exports = {
  createJourney, updateJourney, listJourneys, getJourney, deleteJourney, setJourneyStatus,
  enrollCustomer, enrollSegmentMembers, processDueSteps, journeyStats,
  interpolate, // exported for tests
};
