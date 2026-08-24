/**
 * HotelService — multi-night room reservations. The core new mechanic
 * versus AppointmentService is the availability check: a date-RANGE
 * overlap across calendar nights, not a time-of-day overlap within one
 * day, plus a room status state machine (available/occupied/cleaning/
 * maintenance) that a person's calendar doesn't need.
 *
 * Billing at check-out reuses posSaleService.checkout() exactly like every
 * other module — the only genuinely new accounting wrinkle is the advance
 * deposit, which is handled by aiming the SAME liability account used at
 * booking time back through checkout's ordinary payment-account logic at
 * check-out (see Reservation.depositLiabilityAccountId) rather than any
 * hotel-specific ledger code.
 */
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const posSaleService = require('../../../services/posSaleService');
const accountingService = require('../../../services/accountingService');

function createRoom(input) {
  const { companyId, branchId, roomNumber, roomType, ratePerNight, billingProductId, billingVariantId } = input;
  if (!roomNumber || !ratePerNight) throw new Error('roomNumber and ratePerNight are required.');
  return Room.create({ companyId, branchId, roomNumber, roomType, ratePerNight, billingProductId, billingVariantId });
}

function listRooms(companyId, branchId) {
  const filter = { companyId, isActive: true };
  if (branchId) filter.branchId = branchId;
  return Room.find(filter);
}

/** Was missing — a typo'd room number or a rate correction had no way to be fixed. Deliberately
 * excludes billingProductId/billingVariantId (the sellable link — changing it would retroactively
 * reinterpret past reservations' bills). */
function updateRoom(companyId, id, updates) {
  const allowed = ['roomNumber', 'roomType', 'ratePerNight'];
  const set = {};
  for (const key of allowed) if (updates[key] !== undefined) set[key] = updates[key];
  return Room.findOneAndUpdate({ _id: id, companyId }, set, { new: true, runValidators: true });
}

/** Soft-deactivate — past reservations reference rooms by id and must keep resolving.
 * Refuses on a room that's currently occupied, same "can't remove what's in active use"
 * rule as Branch/Table elsewhere in this codebase. */
async function deactivateRoom(companyId, id) {
  const room = await Room.findOne({ _id: id, companyId });
  if (!room) return null;
  if (room.status === 'occupied') throw new Error('Cannot remove an occupied room — check the guest out first.');
  room.isActive = false;
  await room.save();
  return room;
}

/** Reservations, most recent first — the UI's only way to browse existing bookings without knowing an ID up front. */
function listReservations(companyId, { status, roomId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (roomId) filter.roomId = roomId;
  return Reservation.find(filter).populate('roomId', 'roomNumber roomType').populate('customerId', 'name').sort({ checkInDate: -1, createdAt: -1 });
}

/** True if no booked/checked-in reservation for this room overlaps [checkInDate, checkOutDate). Checkout day itself doesn't count as occupied — standard hotel convention (new guest can check in the same day another checks out). */
async function isRoomAvailable(roomId, checkInDate, checkOutDate, excludeReservationId = null) {
  const overlap = await Reservation.findOne({
    roomId,
    status: { $in: ['booked', 'checked_in'] },
    _id: { $ne: excludeReservationId },
    checkInDate: { $lt: checkOutDate },
    checkOutDate: { $gt: checkInDate },
  });
  return !overlap;
}

function nightsBetween(checkInDate, checkOutDate) {
  const ms = new Date(checkOutDate) - new Date(checkInDate);
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Books a reservation, optionally taking an advance deposit. If a deposit
 * is given, posts Dr advanceReceivedInAccountId (cash/bank), Cr
 * depositLiabilityAccountId — the deposit is owed-but-unearned until the
 * stay is actually billed at check-out.
 */
async function bookReservation(input) {
  const {
    companyId, branchId, roomId, customerId, guestName, checkInDate, checkOutDate, guests,
    advanceAmount, advanceReceivedInAccountId, depositLiabilityAccountId, userId,
  } = input;

  if (!(new Date(checkInDate) < new Date(checkOutDate))) throw new Error('checkOutDate must be after checkInDate.');

  const room = await Room.findOne({ _id: roomId, companyId });
  if (!room) throw new Error('Room not found.');

  const session = await mongoose.startSession();
  try {
    let reservation;
    await session.withTransaction(async () => {
      const available = await isRoomAvailable(roomId, new Date(checkInDate), new Date(checkOutDate));
      if (!available) throw new Error('This room is already booked for part or all of that date range.');

      [reservation] = await Reservation.create(
        [{
          companyId, branchId, roomId, customerId, guestName, checkInDate, checkOutDate, guests: guests || 1,
          ratePerNight: room.ratePerNight, advanceAmount: advanceAmount || 0,
          advanceReceivedInAccountId: advanceAmount ? advanceReceivedInAccountId : null,
          depositLiabilityAccountId: advanceAmount ? depositLiabilityAccountId : null,
          userId,
        }],
        { session }
      );

      if (advanceAmount > 0) {
        if (!advanceReceivedInAccountId || !depositLiabilityAccountId) {
          throw new Error('advanceReceivedInAccountId and depositLiabilityAccountId are required when taking an advance.');
        }
        await accountingService.postVoucher({
          companyId, branchId, type: 'receipt', narration: `Advance deposit for reservation at ${room.roomNumber}`,
          entries: [
            { accountId: advanceReceivedInAccountId, debit: advanceAmount, credit: 0 },
            { accountId: depositLiabilityAccountId, debit: 0, credit: advanceAmount },
          ],
          referenceType: 'Reservation', referenceId: reservation._id, userId,
        }, session);
      }
    });
    return reservation;
  } finally {
    session.endSession();
  }
}

async function checkIn(reservationId) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) throw new Error('Reservation not found.');
  if (reservation.status !== 'booked') throw new Error(`Cannot check in a reservation with status "${reservation.status}".`);

  reservation.status = 'checked_in';
  await reservation.save();
  await Room.findByIdAndUpdate(reservation.roomId, { status: 'occupied' });
  return reservation;
}

async function addExtraCharge(reservationId, { productId, variantId, description, quantity, unitPrice }) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) throw new Error('Reservation not found.');
  if (reservation.status !== 'checked_in') throw new Error('Can only add extras to a currently checked-in reservation.');

  reservation.extraCharges.push({ productId, variantId, description, quantity, unitPrice });
  await reservation.save();
  return reservation;
}

/**
 * Bills the full stay (nights × rate + any extras) through the ordinary
 * checkout. If the reservation took an advance, that liability account is
 * passed as a payment line covering however much of the total it accounts
 * for — checkout's own voucher logic debits it (clearing the liability)
 * and credits revenue, with no hotel-specific accounting code.
 */
async function checkOut(reservationId, { warehouseId, finalPaymentAccountId, posTerminalId, userId }) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) throw new Error('Reservation not found.');
  if (reservation.status !== 'checked_in') throw new Error(`Cannot check out a reservation with status "${reservation.status}".`);
  if (!warehouseId) throw new Error('warehouseId is required — Sale.warehouseId is a required core field for branch scoping, even though a room-night has no physical stock to deduct.');

  const room = await Room.findById(reservation.roomId);
  if (!room) throw new Error('Room not found.');

  const nights = nightsBetween(reservation.checkInDate, reservation.checkOutDate);
  const roomTotal = nights * reservation.ratePerNight;
  const extrasTotal = reservation.extraCharges.reduce((sum, e) => sum + e.quantity * e.unitPrice, 0);
  const grandTotal = roomTotal + extrasTotal;

  const items = [
    { productId: room.billingProductId, variantId: room.billingVariantId, quantity: nights, unitPrice: reservation.ratePerNight },
    ...reservation.extraCharges.map((e) => ({ productId: e.productId, variantId: e.variantId, quantity: e.quantity, unitPrice: e.unitPrice })),
  ];

  const payments = [];
  const advanceApplied = Math.min(reservation.advanceAmount, grandTotal);
  if (advanceApplied > 0) {
    payments.push({ paymentAccountId: reservation.depositLiabilityAccountId, method: 'advance_applied', amount: advanceApplied });
  }
  const remaining = Math.round((grandTotal - advanceApplied) * 100) / 100;
  if (remaining > 0) {
    if (!finalPaymentAccountId) throw new Error(`PKR ${remaining} remains after the advance — finalPaymentAccountId is required to collect it.`);
    payments.push({ paymentAccountId: finalPaymentAccountId, method: 'cash', amount: remaining });
  }

  // The room-night and any extras must all be Products with trackingMode
  // 'service' (see Room.billingProductId's comment and the route
  // documentation) — posSaleService correctly skips stock validation/
  // deduction for those, so warehouseId here is purely a Sale-document
  // scoping field, not a real stockroom being drawn from.
  const sale = await posSaleService.checkout({
    companyId: reservation.companyId, branchId: reservation.branchId, warehouseId,
    customerId: reservation.customerId, posTerminalId, userId,
    items, payments,
  });

  reservation.status = 'checked_out';
  reservation.saleId = sale._id;
  await reservation.save();
  await Room.findByIdAndUpdate(room._id, { status: 'cleaning' }); // needs housekeeping before it can be booked again

  return { sale, reservation, nights, roomTotal, extrasTotal, grandTotal, advanceApplied, remaining };
}

async function markRoomClean(roomId) {
  const room = await Room.findByIdAndUpdate(roomId, { status: 'available' }, { new: true });
  if (!room) throw new Error('Room not found.');
  return room;
}

async function cancelReservation(reservationId) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) throw new Error('Reservation not found.');
  if (!['booked', 'checked_in'].includes(reservation.status)) throw new Error(`Cannot cancel a reservation with status "${reservation.status}".`);

  const wasCheckedIn = reservation.status === 'checked_in'; // captured BEFORE overwriting status below — checking status === 'checked_in' after the assignment would never be true
  reservation.status = 'cancelled';
  await reservation.save();
  if (wasCheckedIn) await Room.findByIdAndUpdate(reservation.roomId, { status: 'cleaning' }); // a guest was physically in the room — it needs housekeeping, not an instant return to available
  return reservation;
}

/** Was missing — correcting a wrong date range or guest count meant cancel-and-rebook, which
 * loses the original booking record. Only allowed while still 'booked' (pre-arrival); once
 * checked in, the stay is underway and dates shouldn't move retroactively. Re-checks room
 * availability for the new range, same as booking fresh. */
async function updateReservation(companyId, reservationId, { checkInDate, checkOutDate, guests }) {
  const reservation = await Reservation.findOne({ _id: reservationId, companyId });
  if (!reservation) throw new Error('Reservation not found.');
  if (reservation.status !== 'booked') throw new Error(`Cannot edit a reservation with status "${reservation.status}".`);

  const newCheckIn = checkInDate ? new Date(checkInDate) : reservation.checkInDate;
  const newCheckOut = checkOutDate ? new Date(checkOutDate) : reservation.checkOutDate;
  if (!(newCheckIn < newCheckOut)) throw new Error('checkOutDate must be after checkInDate.');

  if (checkInDate || checkOutDate) {
    const available = await isRoomAvailable(reservation.roomId, newCheckIn, newCheckOut, reservationId);
    if (!available) throw new Error('This room is already booked for part or all of that new date range.');
  }

  reservation.checkInDate = newCheckIn;
  reservation.checkOutDate = newCheckOut;
  if (guests !== undefined) reservation.guests = guests;
  await reservation.save();
  return reservation;
}

module.exports = {
  createRoom, listRooms, updateRoom, deactivateRoom, isRoomAvailable, nightsBetween,
  bookReservation, updateReservation, listReservations, checkIn, addExtraCharge, checkOut, markRoomClean, cancelReservation,
};
