/**
 * BookingService — event hall booking with per-headcount pricing and a
 * genuinely new accounting mechanic: partial deposit forfeiture on
 * cancellation. Hotel established "advance deposit -> liability -> cleared
 * through the normal checkout voucher at completion"; this module reuses
 * that exact pattern for a completed event, but ALSO has to handle the
 * case Hotel never modeled — the customer cancels, and the business keeps
 * part of the deposit as a cancellation fee while refunding the rest.
 * That's a single voucher with three legs, not two.
 */
const mongoose = require('mongoose');
const EventVenue = require('../models/EventVenue');
const EventPackage = require('../models/EventPackage');
const EventBooking = require('../models/EventBooking');
const posSaleService = require('../../../services/posSaleService');
const accountingService = require('../../../services/accountingService');

function createVenue(input) {
  const { companyId, branchId, name, capacity, baseRentalFee, rentalBillingProductId, rentalBillingVariantId } = input;
  if (!name || !capacity) throw new Error('name and capacity are required.');
  return EventVenue.create({ companyId, branchId, name, capacity, baseRentalFee: baseRentalFee || 0, rentalBillingProductId, rentalBillingVariantId });
}

function listVenues(companyId, branchId) {
  const filter = { companyId, isActive: true };
  if (branchId) filter.branchId = branchId;
  return EventVenue.find(filter);
}

/** Was missing — a capacity/fee correction had no way in. */
function updateVenue(companyId, id, updates) {
  const allowed = ['name', 'capacity', 'baseRentalFee'];
  const set = {};
  for (const key of allowed) if (updates[key] !== undefined) set[key] = updates[key];
  return EventVenue.findOneAndUpdate({ _id: id, companyId }, set, { new: true, runValidators: true });
}

/** Soft-deactivate — past bookings reference the venue by id. */
function deactivateVenue(companyId, id) {
  return EventVenue.findOneAndUpdate({ _id: id, companyId }, { isActive: false }, { new: true });
}

/** Bookings, most recent event first — same gap Hotel's reservations had until fixed: without this, the UI has no way to browse existing bookings. */
function listBookings(companyId, { status, venueId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (venueId) filter.venueId = venueId;
  return EventBooking.find(filter).populate('venueId', 'name').populate('packageId', 'name').populate('customerId', 'name').sort({ eventDate: -1, createdAt: -1 });
}

function createPackage(input) {
  const { companyId, name, pricePerPerson, minGuests, billingProductId, billingVariantId } = input;
  if (!name || !pricePerPerson) throw new Error('name and pricePerPerson are required.');
  return EventPackage.create({ companyId, name, pricePerPerson, minGuests: minGuests || 1, billingProductId, billingVariantId });
}

function listPackages(companyId) {
  return EventPackage.find({ companyId, isActive: true });
}

/** Was missing — same reasoning as updateVenue: price correctable, sellable link is not. */
function updatePackage(companyId, id, updates) {
  const allowed = ['name', 'pricePerPerson', 'minGuests'];
  const set = {};
  for (const key of allowed) if (updates[key] !== undefined) set[key] = updates[key];
  return EventPackage.findOneAndUpdate({ _id: id, companyId }, set, { new: true, runValidators: true });
}

function deactivatePackage(companyId, id) {
  return EventPackage.findOneAndUpdate({ _id: id, companyId }, { isActive: false }, { new: true });
}

/** One event per venue per calendar day — simpler than Hotel's multi-night range overlap, since an event doesn't span nights. */
async function isVenueAvailable(venueId, eventDate, excludeBookingId = null) {
  const dayStart = new Date(eventDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(eventDate); dayEnd.setHours(23, 59, 59, 999);

  const conflict = await EventBooking.findOne({
    venueId, status: { $in: ['booked'] }, _id: { $ne: excludeBookingId },
    eventDate: { $gte: dayStart, $lte: dayEnd },
  });
  return !conflict;
}

async function bookEvent(input) {
  const {
    companyId, branchId, venueId, packageId, customerId, eventDate, guestCount,
    depositAmount, depositReceivedInAccountId, depositLiabilityAccountId, userId,
  } = input;

  const venue = await EventVenue.findOne({ _id: venueId, companyId });
  if (!venue) throw new Error('Venue not found.');
  const pkg = await EventPackage.findOne({ _id: packageId, companyId });
  if (!pkg) throw new Error('Package not found.');
  if (guestCount < pkg.minGuests) throw new Error(`This package requires at least ${pkg.minGuests} guests, got ${guestCount}.`);

  const session = await mongoose.startSession();
  try {
    let booking;
    await session.withTransaction(async () => {
      const available = await isVenueAvailable(venueId, eventDate);
      if (!available) throw new Error('This venue already has an event booked that day.');

      [booking] = await EventBooking.create(
        [{
          companyId, branchId, venueId, packageId, customerId, eventDate, guestCount,
          pricePerPerson: pkg.pricePerPerson, venueRentalFee: venue.baseRentalFee,
          depositAmount: depositAmount || 0,
          depositReceivedInAccountId: depositAmount ? depositReceivedInAccountId : null,
          depositLiabilityAccountId: depositAmount ? depositLiabilityAccountId : null,
          userId,
        }],
        { session }
      );

      if (depositAmount > 0) {
        if (!depositReceivedInAccountId || !depositLiabilityAccountId) {
          throw new Error('depositReceivedInAccountId and depositLiabilityAccountId are required when taking a deposit.');
        }
        await accountingService.postVoucher({
          companyId, branchId, type: 'receipt', narration: `Advance deposit for event at ${venue.name}`,
          entries: [
            { accountId: depositReceivedInAccountId, debit: depositAmount, credit: 0 },
            { accountId: depositLiabilityAccountId, debit: 0, credit: depositAmount },
          ],
          referenceType: 'EventBooking', referenceId: booking._id, userId,
        }, session);
      }
    });
    return booking;
  } finally {
    session.endSession();
  }
}

/** Bills the event through the ordinary checkout — a per-headcount line plus the flat venue rental — clearing the deposit liability exactly like Hotel's check-out does. */
async function completeEvent(bookingId, { warehouseId, finalPaymentAccountId, posTerminalId, userId }) {
  const booking = await EventBooking.findById(bookingId);
  if (!booking) throw new Error('Booking not found.');
  if (booking.status !== 'booked') throw new Error(`Cannot complete a booking with status "${booking.status}".`);
  if (!warehouseId) throw new Error('warehouseId is required — Sale.warehouseId is a required core field even though nothing physical is deducted (all lines here are services).');

  const venue = await EventVenue.findById(booking.venueId);
  const pkg = await EventPackage.findById(booking.packageId);

  const guestTotal = booking.guestCount * booking.pricePerPerson;
  const grandTotal = guestTotal + booking.venueRentalFee;

  const items = [
    { productId: pkg.billingProductId, variantId: pkg.billingVariantId, quantity: booking.guestCount, unitPrice: booking.pricePerPerson },
  ];
  if (booking.venueRentalFee > 0) {
    items.push({ productId: venue.rentalBillingProductId, variantId: venue.rentalBillingVariantId, quantity: 1, unitPrice: booking.venueRentalFee });
  }

  const payments = [];
  const depositApplied = Math.min(booking.depositAmount, grandTotal);
  if (depositApplied > 0) {
    payments.push({ paymentAccountId: booking.depositLiabilityAccountId, method: 'advance_applied', amount: depositApplied });
  }
  const remaining = Math.round((grandTotal - depositApplied) * 100) / 100;
  if (remaining > 0) {
    if (!finalPaymentAccountId) throw new Error(`PKR ${remaining} remains after the deposit — finalPaymentAccountId is required.`);
    payments.push({ paymentAccountId: finalPaymentAccountId, method: 'cash', amount: remaining });
  }

  const sale = await posSaleService.checkout({
    companyId: booking.companyId, branchId: booking.branchId, warehouseId,
    customerId: booking.customerId, posTerminalId, userId, items, payments,
  });

  booking.status = 'completed';
  booking.saleId = sale._id;
  await booking.save();

  return { sale, booking, guestTotal, venueRentalFee: booking.venueRentalFee, grandTotal, depositApplied, remaining };
}

/**
 * Cancels a booking, splitting whatever deposit was taken into a forfeited
 * portion (kept as recognized revenue — the business earned it as a
 * cancellation fee) and a refunded portion (returned as cash). One voucher,
 * three legs: Dr the liability for the FULL deposit (clearing it — the
 * obligation to provide the service is gone either way), Cr revenue for
 * the forfeited share, Cr the refund account for the rest. Debits and
 * credits still balance (forfeited + refunded === the full deposit being cleared).
 */
async function cancelBooking(bookingId, { forfeitPercent, revenueAccountId, refundAccountId, userId }) {
  const booking = await EventBooking.findById(bookingId);
  if (!booking) throw new Error('Booking not found.');
  if (booking.status !== 'booked') throw new Error(`Cannot cancel a booking with status "${booking.status}".`);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (booking.depositAmount > 0) {
        const pct = Math.max(0, Math.min(100, forfeitPercent ?? 0));
        const forfeitedAmount = Math.round(booking.depositAmount * (pct / 100) * 100) / 100;
        const refundedAmount = Math.round((booking.depositAmount - forfeitedAmount) * 100) / 100;

        const entries = [{ accountId: booking.depositLiabilityAccountId, debit: booking.depositAmount, credit: 0 }];
        if (forfeitedAmount > 0) {
          if (!revenueAccountId) throw new Error('revenueAccountId is required when any portion of the deposit is forfeited.');
          entries.push({ accountId: revenueAccountId, debit: 0, credit: forfeitedAmount });
        }
        if (refundedAmount > 0) {
          if (!refundAccountId) throw new Error('refundAccountId is required when any portion of the deposit is refunded.');
          entries.push({ accountId: refundAccountId, debit: 0, credit: refundedAmount });
        }

        await accountingService.postVoucher({
          companyId: booking.companyId, branchId: booking.branchId, type: 'journal',
          narration: `Cancelled event — ${pct}% of deposit forfeited as cancellation fee, ${100 - pct}% refunded`,
          entries, referenceType: 'EventBooking', referenceId: booking._id, userId,
        }, session);
      }

      booking.status = 'cancelled';
      await booking.save({ session });
    });
    return booking;
  } finally {
    session.endSession();
  }
}

module.exports = {
  createVenue, listVenues, updateVenue, deactivateVenue,
  createPackage, listPackages, updatePackage, deactivatePackage,
  isVenueAvailable, bookEvent, listBookings, completeEvent, cancelBooking,
};
