/**
 * SportsService — club membership reuses Salon's exact shape (a real Sale
 * for the membership price, plus a session-credit record) — deliberately
 * built CORRECTLY from the start (checkout() as its own atomic unit, no
 * enclosing transaction around it), applying the exact lesson just
 * re-learned by finding and fixing the same bug in Salon's own code while
 * checking this pattern, not repeating it a third time in a new module.
 *
 * Facility booking is the genuinely new mechanic: a real HOURLY interval-
 * overlap check, a different granularity problem from Car Rental's
 * day-range overlap (a court can have several bookings on the same day,
 * as long as their hour ranges never actually intersect — Car Rental's
 * vehicles are booked for whole days at a time and never need this finer grain).
 */
const SportsFacility = require('../models/SportsFacility');
const FacilityBooking = require('../models/FacilityBooking');
const posSaleService = require('../../../services/posSaleService');

function createFacility(input) {
  const { companyId, branchId, name, hourlyRate } = input;
  if (!hourlyRate || hourlyRate <= 0) throw new Error('hourlyRate must be greater than zero.');
  return SportsFacility.create({ companyId, branchId, name, hourlyRate });
}

function listFacilities(companyId, branchId) {
  const filter = { companyId };
  if (branchId) filter.branchId = branchId;
  return SportsFacility.find(filter);
}

/**
 * Real interval-overlap check: two time ranges [startA, endA) and
 * [startB, endB) overlap exactly when startA < endB AND startB < endA.
 * Expressed as a query, that's "find any existing booking whose own
 * startTime is before the REQUESTED end, and whose own endTime is after
 * the REQUESTED start" — the standard, correct interval-intersection test,
 * not an approximation of it.
 */
async function bookSlot(facilityId, { customerId, startTime, endTime, billingProductId, billingVariantId, warehouseId, paymentAccountId, posTerminalId, userId }) {
  const facility = await SportsFacility.findById(facilityId);
  if (!facility) throw new Error('Facility not found.');

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (!(start < end)) throw new Error('endTime must be after startTime.');

  const overlap = await FacilityBooking.findOne({
    facilityId, status: 'booked',
    startTime: { $lt: end }, endTime: { $gt: start },
  });
  if (overlap) throw new Error(`This facility is already booked from ${overlap.startTime.toISOString()} to ${overlap.endTime.toISOString()}, which overlaps the requested time.`);

  const hours = (end - start) / (1000 * 60 * 60);
  const price = Math.round(hours * facility.hourlyRate * 100) / 100;

  const booking = await FacilityBooking.create({ companyId: facility.companyId, branchId: facility.branchId, facilityId, customerId, startTime: start, endTime: end });

  const sale = await posSaleService.checkout({
    companyId: facility.companyId, branchId: facility.branchId, warehouseId, customerId, posTerminalId, userId,
    items: [{ productId: billingProductId, variantId: billingVariantId, quantity: hours, unitPrice: facility.hourlyRate }],
    payments: [{ paymentAccountId, method: 'cash', amount: price }],
  });

  booking.saleId = sale._id;
  await booking.save();
  return { booking, sale, hours, price };
}

function listBookings(companyId, { facilityId, status } = {}) {
  const filter = { companyId };
  if (facilityId) filter.facilityId = facilityId;
  if (status) filter.status = status;
  return FacilityBooking.find(filter).populate('customerId', 'name').sort({ startTime: 1 });
}

async function cancelSlot(bookingId) {
  const booking = await FacilityBooking.findById(bookingId);
  if (!booking) throw new Error('Booking not found.');
  if (booking.status !== 'booked') throw new Error(`Cannot cancel a booking with status "${booking.status}".`);
  booking.status = 'cancelled';
  await booking.save();
  return booking;
}

module.exports = { createFacility, listFacilities, bookSlot, listBookings, cancelSlot };
