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

module.exports = { addVehicle, listFleet, findAvailableVehicle, bookRental, listBookings, returnVehicle };
