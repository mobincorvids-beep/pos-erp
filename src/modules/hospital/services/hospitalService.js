/**
 * HospitalService — OPD check-in queue and consultation billing. The
 * genuinely new mechanic: a FIFO queue, not a scheduled time slot. Every
 * booking-shaped module so far (Hotel, Banquet, Appointments) reserves a
 * specific future date/time; a walk-in patient instead gets a sequential
 * position and waits for callNext() to process them in the order they
 * arrived — closer to a ticket/queue system than a calendar.
 */
const mongoose = require('mongoose');
const Visit = require('../models/Visit');
const posSaleService = require('../../../services/posSaleService');

/**
 * Checks in a patient — queueNumber is 1 + however many visits already
 * exist for this branch TODAY (reset naturally every day since it's
 * scoped to "today," not a running total that grows forever).
 */
async function checkIn({ companyId, branchId, customerId, chiefComplaint, consultationFee, billingProductId, billingVariantId }) {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);

  const todaysCount = await Visit.countDocuments({ branchId, checkedInAt: { $gte: dayStart, $lte: dayEnd } });

  return Visit.create({
    companyId, branchId, customerId, chiefComplaint,
    consultationFee: consultationFee || 0, billingProductId, billingVariantId,
    queueNumber: todaysCount + 1,
  });
}

/** The waiting list, in the order they'll be seen — queueNumber ascending, which is the same as check-in order. */
function currentQueue(branchId) {
  return Visit.find({ branchId, status: 'waiting' }).populate('customerId', 'name').sort({ queueNumber: 1 });
}

/**
 * Pulls the longest-waiting patient for this branch and marks them
 * in_consultation — strict FIFO, not "any waiting visit." A front desk
 * calling this button doesn't get to pick who's next, the queue does.
 */
async function callNext(branchId, employeeId) {
  const next = await Visit.findOneAndUpdate(
    { branchId, status: 'waiting' },
    { status: 'in_consultation', calledAt: new Date(), employeeId },
    { sort: { queueNumber: 1 }, new: true }
  );
  if (!next) throw new Error('No patients waiting.');
  return next;
}

function listVisits(companyId, { branchId, status } = {}) {
  const filter = { companyId };
  if (branchId) filter.branchId = branchId;
  if (status) filter.status = status;
  return Visit.find(filter).populate('customerId', 'name').populate('employeeId', 'name').sort({ checkedInAt: -1 });
}

/** Bills the consultation fee through the ordinary checkout and closes the visit. */
async function completeVisit(visitId, { warehouseId, paymentAccountId, posTerminalId, userId }) {
  const visit = await Visit.findById(visitId);
  if (!visit) throw new Error('Visit not found.');
  if (visit.status !== 'in_consultation') throw new Error(`Cannot complete a visit with status "${visit.status}" — call the patient in first.`);
  if (!visit.billingProductId) throw new Error('This visit has no billing product configured — set one at check-in.');

  const payments = visit.consultationFee > 0
    ? [{ paymentAccountId, method: 'cash', amount: visit.consultationFee }]
    : [];

  const sale = await posSaleService.checkout({
    companyId: visit.companyId, branchId: visit.branchId, warehouseId,
    customerId: visit.customerId, posTerminalId, userId,
    items: [{ productId: visit.billingProductId, variantId: visit.billingVariantId, quantity: 1, unitPrice: visit.consultationFee }],
    payments,
  });

  visit.status = 'completed';
  visit.completedAt = new Date();
  visit.saleId = sale._id;
  await visit.save();

  return { sale, visit };
}

async function cancelVisit(visitId) {
  const visit = await Visit.findById(visitId);
  if (!visit) throw new Error('Visit not found.');
  if (!['waiting', 'in_consultation'].includes(visit.status)) throw new Error(`Cannot cancel a visit with status "${visit.status}".`);
  visit.status = 'cancelled';
  await visit.save();
  return visit;
}

module.exports = { checkIn, currentQueue, callNext, listVisits, completeVisit, cancelVisit };
