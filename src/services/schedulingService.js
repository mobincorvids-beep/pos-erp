/**
 * SchedulingService — a straightforward greedy forward scheduler for
 * WorkOrder operations. Not a finite-capacity solver: it walks a routing's
 * operations in sequence, and for each one finds the next available slice(s)
 * of capacity on that operation's work center, starting from either "now" or
 * when the previous operation finished, packing multiple operations into the
 * same day when capacity allows and spilling into following days otherwise.
 * It respects other work orders already scheduled on the same work center
 * (read from their persisted `schedule` arrays) so it never double-books a
 * work center past its capacityHoursPerDay.
 */
const WorkOrder = require('../models/WorkOrder');

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function dayKey(date) {
  return dayStart(date).toISOString().slice(0, 10);
}

/**
 * Builds a { "workCenterId|dayKey": hoursBooked } map from every OTHER
 * work order's schedule entries that are still 'scheduled' or 'in_progress'
 * (completed ones no longer occupy future capacity).
 */
async function loadExistingBookings(companyId, excludeWorkOrderId) {
  const rows = await WorkOrder.find({
    companyId,
    _id: { $ne: excludeWorkOrderId },
    'schedule.0': { $exists: true },
  }).select('schedule');

  const bookings = {};
  for (const wo of rows) {
    for (const op of wo.schedule) {
      if (op.status === 'completed') continue;
      const hours = (op.scheduledEnd - op.scheduledStart) / (60 * 60 * 1000);
      const key = `${op.workCenterId}|${dayKey(op.scheduledStart)}`;
      bookings[key] = (bookings[key] || 0) + hours;
    }
  }
  return bookings;
}

/**
 * Schedules every operation of `routing` for `workOrder`, respecting each
 * work center's capacityHoursPerDay (from `workCentersById`, a Map keyed by
 * work center id string -> capacityHoursPerDay). Returns an array of
 * scheduled-operation sub-documents ready to assign to workOrder.schedule.
 */
async function scheduleWorkOrder({ companyId, workOrderId, routing, workCentersById, startFrom }) {
  const bookings = await loadExistingBookings(companyId, workOrderId);
  const operations = [...routing.operations].sort((a, b) => a.sequence - b.sequence);

  let cursor = new Date(startFrom || Date.now());
  const schedule = [];

  for (const op of operations) {
    const capacity = workCentersById.get(String(op.workCenterId));
    if (!capacity || capacity <= 0) {
      throw new Error(`Work center for operation "${op.operationName}" has no usable daily capacity.`);
    }

    let remaining = op.estimatedHours;
    let segStart = null;
    let segEnd = null;

    while (remaining > 0) {
      const key = `${op.workCenterId}|${dayKey(cursor)}`;
      const bookedToday = bookings[key] || 0;
      const availableToday = capacity - bookedToday;

      if (availableToday <= 0) {
        // Fully booked today — roll to the start of the next day.
        cursor = new Date(dayStart(cursor).getTime() + DAY_MS);
        continue;
      }

      const use = Math.min(availableToday, remaining);
      const dayBase = dayStart(cursor).getTime();
      const offsetMs = bookedToday * 60 * 60 * 1000;
      const useMs = use * 60 * 60 * 1000;
      const start = new Date(Math.max(cursor.getTime(), dayBase + offsetMs));
      const end = new Date(start.getTime() + useMs);

      if (!segStart) segStart = start;
      segEnd = end;

      bookings[key] = bookedToday + use;
      remaining -= use;

      if (remaining > 0) {
        cursor = new Date(dayStart(cursor).getTime() + DAY_MS); // spill to next day
      } else {
        cursor = end; // next operation can start right where this one finished
      }
    }

    schedule.push({
      routingOperationId: op._id,
      sequence: op.sequence,
      workCenterId: op.workCenterId,
      operationName: op.operationName,
      estimatedHours: op.estimatedHours,
      actualHours: null,
      scheduledStart: segStart,
      scheduledEnd: segEnd,
      status: 'scheduled',
      qcRequired: !!op.qcRequired,
      qcCriteria: op.qcCriteria || '',
    });
  }

  return schedule;
}

module.exports = { scheduleWorkOrder, loadExistingBookings };
