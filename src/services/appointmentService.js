/**
 * AppointmentService — booking with double-booking prevention. Billing an
 * appointment reuses PosSaleService.checkout() directly (same pattern as
 * PharmacyService.dispensePrescription): the appointment just links to the
 * resulting sale rather than reimplementing billing logic.
 */
const Appointment = require('../models/Appointment');
const posSaleService = require('./posSaleService');

/** True if the staff member has no overlapping appointment in this window. */
async function isStaffAvailable(staffUserId, startTime, endTime, excludeAppointmentId = null) {
  const overlap = await Appointment.findOne({
    staffUserId,
    status: { $in: ['scheduled', 'confirmed'] },
    _id: { $ne: excludeAppointmentId },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });
  return !overlap;
}

async function book(input) {
  const {
    companyId, branchId, customerId, staffUserId, serviceName, productId,
    startTime, endTime, notes, userId,
  } = input;

  if (!(startTime < endTime)) throw new Error('endTime must be after startTime.');

  const available = await isStaffAvailable(staffUserId, new Date(startTime), new Date(endTime));
  if (!available) throw new Error('This staff member already has an appointment in that time slot.');

  return Appointment.create({
    companyId, branchId, customerId, staffUserId, serviceName, productId,
    startTime, endTime, notes, userId, status: 'scheduled',
  });
}

async function reschedule(appointmentId, startTime, endTime) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new Error('Appointment not found.');
  if (!(startTime < endTime)) throw new Error('endTime must be after startTime.');

  const available = await isStaffAvailable(appointment.staffUserId, new Date(startTime), new Date(endTime), appointmentId);
  if (!available) throw new Error('This staff member already has an appointment in that time slot.');

  appointment.startTime = startTime;
  appointment.endTime = endTime;
  await appointment.save();
  return appointment;
}

async function updateStatus(appointmentId, status) {
  const valid = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];
  if (!valid.includes(status)) throw new Error(`Invalid status "${status}".`);

  const appointment = await Appointment.findByIdAndUpdate(appointmentId, { status }, { new: true });
  if (!appointment) throw new Error('Appointment not found.');
  return appointment;
}

/** Bills the appointment via the normal POS checkout, then links the sale back. */
async function billAppointment(appointmentId, saleInput) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw new Error('Appointment not found.');
  if (appointment.status === 'completed') throw new Error('Appointment already billed.');

  const sale = await posSaleService.checkout(saleInput);

  appointment.saleId = sale._id;
  appointment.status = 'completed';
  await appointment.save();

  return { sale, appointment };
}

/** Staff schedule for a date range — the calendar view. */
async function staffSchedule(staffUserId, from, to) {
  return Appointment.find({
    staffUserId, startTime: { $gte: new Date(from) }, endTime: { $lte: new Date(to) },
  }).sort({ startTime: 1 });
}

module.exports = { book, reschedule, updateStatus, billAppointment, staffSchedule, isStaffAvailable };
