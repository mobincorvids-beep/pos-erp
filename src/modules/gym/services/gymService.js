/**
 * GymService — class scheduling with capacity limits and automatic
 * waitlist promotion. The mechanic this module exists to exercise: a
 * shared-capacity resource, not an exclusive one. Every booking-shaped
 * module before this reserved a whole resource per booking (Hotel's room,
 * Banquet's venue, Hospital's single "next" position); a class session
 * has N seats, many customers enroll into the SAME session concurrently,
 * and cancelling a seat has to correctly promote the longest-waiting
 * person on the waitlist — not silently leave the seat empty, and not
 * pick an arbitrary waitlisted member.
 */
const mongoose = require('mongoose');
const GymClass = require('../models/GymClass');
const ClassSession = require('../models/ClassSession');

function createClass(input) {
  const { companyId, branchId, name, instructorEmployeeId, capacity, durationMinutes } = input;
  if (!name || !capacity) throw new Error('name and capacity are required.');
  return GymClass.create({ companyId, branchId, name, instructorEmployeeId, capacity, durationMinutes: durationMinutes || 60 });
}

function listClasses(companyId, branchId) {
  const filter = { companyId, isActive: true };
  if (branchId) filter.branchId = branchId;
  return GymClass.find(filter);
}

/** Was missing — a mistyped name or a capacity change had no way in. Deliberately doesn't
 * retroactively resize already-scheduled sessions (they snapshot capacity at creation, see
 * scheduleSession) — only affects sessions scheduled after the edit. */
function updateClass(companyId, id, updates) {
  const allowed = ['name', 'instructorEmployeeId', 'capacity', 'durationMinutes'];
  const set = {};
  for (const key of allowed) if (updates[key] !== undefined) set[key] = updates[key];
  return GymClass.findOneAndUpdate({ _id: id, companyId }, set, { new: true, runValidators: true });
}

/** Soft-deactivate, not delete — past sessions reference the class by id. */
function deactivateClass(companyId, id) {
  return GymClass.findOneAndUpdate({ _id: id, companyId }, { isActive: false }, { new: true });
}

/** Capacity is snapshotted from the class at creation time — deliberately, so a later capacity change never retroactively resizes an already-scheduled session. */
async function scheduleSession(gymClassId, startTime) {
  const gymClass = await GymClass.findById(gymClassId);
  if (!gymClass) throw new Error('Class not found.');
  return ClassSession.create({ companyId: gymClass.companyId, gymClassId, startTime, capacity: gymClass.capacity });
}

function listSessions(companyId, gymClassId) {
  const filter = { companyId };
  if (gymClassId) filter.gymClassId = gymClassId;
  return ClassSession.find(filter).populate('gymClassId', 'name').sort({ startTime: 1 });
}

/**
 * Enrolls a customer — a real seat if one's open (enrolledCount < capacity),
 * otherwise the back of the waitlist. Returns which happened and, if
 * waitlisted, their exact position, since "you're on a waitlist" alone
 * isn't useful information without knowing how long it is.
 */
async function enroll(sessionId, customerId) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const classSession = await ClassSession.findById(sessionId).session(session);
      if (!classSession) throw new Error('Session not found.');
      if (classSession.status !== 'scheduled') throw new Error(`Cannot enroll in a session with status "${classSession.status}".`);
      if (classSession.enrolledCustomerIds.some((id) => String(id) === String(customerId))) throw new Error('Already enrolled in this session.');
      if (classSession.waitlistCustomerIds.some((id) => String(id) === String(customerId))) throw new Error('Already on the waitlist for this session.');

      if (classSession.enrolledCustomerIds.length < classSession.capacity) {
        classSession.enrolledCustomerIds.push(customerId);
        await classSession.save({ session });
        result = { enrolled: true, waitlisted: false };
      } else {
        classSession.waitlistCustomerIds.push(customerId);
        await classSession.save({ session });
        result = { enrolled: false, waitlisted: true, waitlistPosition: classSession.waitlistCustomerIds.length };
      }
    });
    return result;
  } finally {
    session.endSession();
  }
}

/**
 * Cancels an enrolled customer's seat. If anyone's waiting, the LONGEST-
 * waiting one (index 0 — the front of the array) is automatically
 * promoted into the now-open seat, not left empty and not an arbitrary
 * waitlisted member. Returns who (if anyone) got promoted, so the caller
 * can notify them.
 */
async function cancelEnrollment(sessionId, customerId) {
  const session = await mongoose.startSession();
  try {
    let promotedCustomerId = null;
    await session.withTransaction(async () => {
      const classSession = await ClassSession.findById(sessionId).session(session);
      if (!classSession) throw new Error('Session not found.');

      const idx = classSession.enrolledCustomerIds.findIndex((id) => String(id) === String(customerId));
      if (idx === -1) throw new Error('This customer is not enrolled in this session.');
      classSession.enrolledCustomerIds.splice(idx, 1);

      if (classSession.waitlistCustomerIds.length > 0) {
        promotedCustomerId = classSession.waitlistCustomerIds.shift(); // front of the array = longest-waiting
        classSession.enrolledCustomerIds.push(promotedCustomerId);
      }

      await classSession.save({ session });
    });
    return { promotedCustomerId };
  } finally {
    session.endSession();
  }
}

function sessionRoster(sessionId) {
  return ClassSession.findById(sessionId).populate('enrolledCustomerIds', 'name').populate('waitlistCustomerIds', 'name');
}

/** Was missing — a scheduling mistake (wrong time, instructor unavailable) had no way to be
 * called off entirely; only individual enrollments could be cancelled one at a time. Marks
 * the whole session cancelled and clears both rosters — the UI is expected to notify
 * everyone who was enrolled or waitlisted, since this doesn't send anything itself. */
async function cancelSession(companyId, sessionId) {
  const classSession = await ClassSession.findOne({ _id: sessionId, companyId });
  if (!classSession) throw new Error('Session not found.');
  if (classSession.status === 'completed') throw new Error('Cannot cancel a session that already completed.');
  classSession.status = 'cancelled';
  classSession.enrolledCustomerIds = [];
  classSession.waitlistCustomerIds = [];
  await classSession.save();
  return classSession;
}

module.exports = {
  createClass, listClasses, updateClass, deactivateClass,
  scheduleSession, listSessions, cancelSession, enroll, cancelEnrollment, sessionRoster,
};
