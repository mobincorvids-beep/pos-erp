/**
 * CarRentalService — fleet pool booking. The genuinely new mechanic:
 * findAvailableVehicle() searches across EVERY vehicle in a class for one
 * with no overlapping booking, not one named resource's own calendar
 * (Hotel's room, Banquet's venue). A customer never picks which physical
 * car they get — the system assigns whichever one happens to be free.
 */
const FleetVehicle = require('../models/FleetVehicle');
const RentalBooking = require('../models/RentalBooking');
const posSaleService = require('../../../services/posSaleService');
const accountingService = require('../../../services/accountingService');

function addVehicle(input) {
  const { companyId, branchId, vehicleClass, registrationNumber, dailyRate } = input;
  return FleetVehicle.create({ companyId, branchId, vehicleClass, registrationNumber, dailyRate });
}

function listFleet(companyId, { vehicleClass, status } = {}) {
  const filter = { companyId };
  if (vehicleClass) filter.vehicleClass = vehicleClass;
  if (status) filter.status = status;
  return FleetVehicle.find(filter);
}

/** Finds ANY vehicle in the class with no overlapping active booking — a pool search, not a single-resource check. */
async function findAvailableVehicle(companyId, vehicleClass, startDate, endDate) {
  const candidates = await FleetVehicle.find({ companyId, vehicleClass, status: { $ne: 'maintenance' } });
  for (const vehicle of candidates) {
    const overlap = await RentalBooking.findOne({
      vehicleId: vehicle._id, status: 'booked',
      startDate: { $lt: endDate }, endDate: { $gt: startDate },
    });
    if (!overlap) return vehicle; // first free one wins — doesn't matter which, they're interchangeable within a class
  }
  return null;
}

async function bookRental(input) {
  const {
    companyId, branchId, vehicleClass, customerId, startDate, endDate, dailyRate,
    depositAmount, depositReceivedInAccountId, depositLiabilityAccountId,
    rentalBillingProductId, rentalBillingVariantId, userId,
  } = input;
  if (!(new Date(startDate) < new Date(endDate))) throw new Error('endDate must be after startDate.');

  const vehicle = await findAvailableVehicle(companyId, vehicleClass, new Date(startDate), new Date(endDate));
  if (!vehicle) throw new Error(`No "${vehicleClass}" vehicle is available for that date range — every unit in the class is already booked.`);

  const booking = await RentalBooking.create({
    companyId, branchId, vehicleClass, vehicleId: vehicle._id, customerId, startDate, endDate,
    dailyRate: dailyRate ?? vehicle.dailyRate, depositAmount: depositAmount || 0,
    depositReceivedInAccountId: depositAmount ? depositReceivedInAccountId : null,
    depositLiabilityAccountId: depositAmount ? depositLiabilityAccountId : null,
    rentalBillingProductId, rentalBillingVariantId,
  });

  if (depositAmount > 0) {
    await accountingService.postVoucher({
      companyId, branchId, type: 'receipt', narration: `Rental deposit for ${vehicleClass}`,
      entries: [
        { accountId: depositReceivedInAccountId, debit: depositAmount, credit: 0 },
        { accountId: depositLiabilityAccountId, debit: 0, credit: depositAmount },
      ],
      referenceType: 'RentalBooking', referenceId: booking._id, userId,
    });
  }

  return booking;
}

function listBookings(companyId, { status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return RentalBooking.find(filter).populate('vehicleId', 'registrationNumber').populate('customerId', 'name').sort({ startDate: -1 });
}

/** Corrects a vehicle's class/rate, or takes it in/out of maintenance. */
async function updateVehicle(vehicleId, { vehicleClass, dailyRate, status }) {
  const vehicle = await FleetVehicle.findById(vehicleId);
  if (!vehicle) throw new Error('Vehicle not found.');

  if (vehicleClass !== undefined) vehicle.vehicleClass = vehicleClass;
  if (dailyRate !== undefined) {
    if (!dailyRate || dailyRate <= 0) throw new Error('dailyRate must be greater than zero.');
    vehicle.dailyRate = dailyRate;
  }
  if (status !== undefined) {
    if (!['available', 'rented', 'maintenance'].includes(status)) throw new Error(`Invalid status "${status}".`);
    vehicle.status = status;
  }

  await vehicle.save();
  return vehicle;
}

/** Retires a vehicle from the fleet — refused while it has any active (not yet returned/cancelled) booking, since that booking still needs this exact unit for its date range. */
async function deleteVehicle(vehicleId) {
  const activeBooking = await RentalBooking.findOne({ vehicleId, status: 'booked' });
  if (activeBooking) throw new Error('Cannot remove a vehicle with an active booking — return or cancel that booking first.');

  const vehicle = await FleetVehicle.findByIdAndDelete(vehicleId);
  if (!vehicle) throw new Error('Vehicle not found.');
  return vehicle;
}

/**
 * Cancels a booking before pickup — the same gap Hardware's rental
 * module had before voidRental was added there: without this, a
 * mistaken booking (wrong dates, customer backed out) permanently
 * occupied that date range against the assigned vehicle with no way
 * back, and any deposit taken stayed stuck as an open liability forever.
 * Only valid while still 'booked' — once actually returned, that's a
 * closed, billed transaction with its own real accounting, same
 * "correct forward, not backward" rule Sale/Prescription/RentalAgreement
 * all follow elsewhere in this app. No vehicle-status release is needed:
 * FleetVehicle.status is never flipped to 'rented' by bookRental in the
 * first place — availability is determined purely by checking for
 * overlapping 'booked' RentalBookings, so cancelling one simply removes
 * it from that overlap check going forward.
 */
async function cancelBooking(bookingId, { refundPercent, refundAccountId, forfeitRevenueAccountId, userId }) {
  const booking = await RentalBooking.findById(bookingId);
  if (!booking) throw new Error('Booking not found.');
  if (booking.status !== 'booked') throw new Error(`Cannot cancel a booking with status "${booking.status}".`);

  if (booking.depositAmount > 0) {
    const pct = Math.max(0, Math.min(100, refundPercent ?? 100));
    const refunded = Math.round(booking.depositAmount * (pct / 100) * 100) / 100;
    const forfeited = Math.round((booking.depositAmount - refunded) * 100) / 100;

    const entries = [{ accountId: booking.depositLiabilityAccountId, debit: booking.depositAmount, credit: 0 }];
    if (refunded > 0) {
      if (!refundAccountId) throw new Error('refundAccountId is required when any amount is refunded.');
      entries.push({ accountId: refundAccountId, debit: 0, credit: refunded });
    }
    if (forfeited > 0) {
      if (!forfeitRevenueAccountId) throw new Error('forfeitRevenueAccountId is required when any amount is forfeited.');
      entries.push({ accountId: forfeitRevenueAccountId, debit: 0, credit: forfeited });
    }

    await accountingService.postVoucher({
      companyId: booking.companyId, branchId: booking.branchId, type: 'journal',
      narration: `Rental booking cancelled — ${pct}% of deposit refunded`,
      entries, referenceType: 'RentalBooking', referenceId: booking._id, userId,
    });
  }

  booking.status = 'cancelled';
  await booking.save();
  return booking;
}

module.exports = { addVehicle, listFleet, findAvailableVehicle, bookRental, listBookings, returnVehicle, updateVehicle, deleteVehicle, cancelBooking };

async function returnVehicle(bookingId, { actualReturnDate, warehouseId, finalPaymentAccountId, userId }) {
  const booking = await RentalBooking.findById(bookingId);
  if (!booking) throw new Error('Booking not found.');
  if (booking.status !== 'booked') throw new Error(`Cannot return a booking with status "${booking.status}".`);

  const returnDate = actualReturnDate ? new Date(actualReturnDate) : new Date();
  const days = Math.max(1, Math.ceil((returnDate - booking.startDate) / (1000 * 60 * 60 * 24)));
  const rentalCharge = Math.round(days * booking.dailyRate * 100) / 100;

  const payments = [];
  if (booking.depositAmount > 0) payments.push({ paymentAccountId: booking.depositLiabilityAccountId, method: 'advance_applied', amount: Math.min(booking.depositAmount, rentalCharge) });
  const remaining = Math.round((rentalCharge - Math.min(booking.depositAmount, rentalCharge)) * 100) / 100;
  if (remaining > 0) {
    if (!finalPaymentAccountId) throw new Error(`PKR ${remaining} remains after the deposit — finalPaymentAccountId is required.`);
    payments.push({ paymentAccountId: finalPaymentAccountId, method: 'cash', amount: remaining });
  }

  const sale = await posSaleService.checkout({
    companyId: booking.companyId, branchId: booking.branchId, warehouseId,
    customerId: booking.customerId, userId,
    items: [{ productId: booking.rentalBillingProductId, variantId: booking.rentalBillingVariantId, quantity: days, unitPrice: booking.dailyRate }],
    payments,
  });

  booking.status = 'returned';
  booking.actualReturnDate = returnDate;
  booking.saleId = sale._id;
  await booking.save();

  return { booking, sale, days, rentalCharge };
}
