/**
 * TravelService — an honest, direct reuse of Hotel's exact
 * deposit-then-bill-remainder pattern, applied to a trip package instead
 * of a room. No invented novelty — the whole point of this module is
 * that it genuinely doesn't need a new mechanic, and forcing one in just
 * to seem distinct would be dishonest about what's actually happening.
 */
const TravelBooking = require('../models/TravelBooking');
const posSaleService = require('../../../services/posSaleService');
const accountingService = require('../../../services/accountingService');

async function bookPackage(input) {
  const {
    companyId, branchId, customerId, packageName, destination, travelDate, price,
    depositAmount, depositReceivedInAccountId, depositLiabilityAccountId,
    billingProductId, billingVariantId, userId,
  } = input;
  if (!price || price <= 0) throw new Error('price must be greater than zero.');

  const booking = await TravelBooking.create({
    companyId, branchId, customerId, packageName, destination, travelDate, price,
    depositAmount: depositAmount || 0, billingProductId, billingVariantId,
    depositReceivedInAccountId: depositAmount ? depositReceivedInAccountId : null,
    depositLiabilityAccountId: depositAmount ? depositLiabilityAccountId : null,
  });

  if (depositAmount > 0) {
    await accountingService.postVoucher({
      companyId, branchId, type: 'receipt', narration: `Travel booking deposit — ${packageName}`,
      entries: [
        { accountId: depositReceivedInAccountId, debit: depositAmount, credit: 0 },
        { accountId: depositLiabilityAccountId, debit: 0, credit: depositAmount },
      ],
      referenceType: 'TravelBooking', referenceId: booking._id, userId,
    });
  }

  return booking;
}

function listBookings(companyId, { status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return TravelBooking.find(filter).populate('customerId', 'name').sort({ travelDate: -1 });
}

async function finalizeBooking(bookingId, { warehouseId, finalPaymentAccountId, posTerminalId, userId }) {
  const booking = await TravelBooking.findById(bookingId);
  if (!booking) throw new Error('Booking not found.');
  if (booking.status !== 'booked') throw new Error(`Cannot finalize a booking with status "${booking.status}".`);

  const payments = [];
  if (booking.depositAmount > 0) payments.push({ paymentAccountId: booking.depositLiabilityAccountId, method: 'advance_applied', amount: booking.depositAmount });
  const remaining = Math.round((booking.price - booking.depositAmount) * 100) / 100;
  if (remaining > 0) {
    if (!finalPaymentAccountId) throw new Error(`PKR ${remaining} remains after the deposit — finalPaymentAccountId is required.`);
    payments.push({ paymentAccountId: finalPaymentAccountId, method: 'cash', amount: remaining });
  }

  const sale = await posSaleService.checkout({
    companyId: booking.companyId, branchId: booking.branchId, warehouseId, customerId: booking.customerId, posTerminalId, userId,
    items: [{ productId: booking.billingProductId, variantId: booking.billingVariantId, quantity: 1, unitPrice: booking.price }],
    payments,
  });

  booking.status = 'completed';
  booking.saleId = sale._id;
  await booking.save();
  return { booking, sale };
}

/** Cancellation with a partial-refund policy — same forfeit-percentage shape Banquet's cancellation and Layaway's cancelPlan already established. */
async function cancelBooking(bookingId, { refundPercent, refundAccountId, forfeitRevenueAccountId, userId }) {
  const booking = await TravelBooking.findById(bookingId);
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
      narration: `Travel booking cancelled — ${pct}% of deposit refunded`,
      entries, referenceType: 'TravelBooking', referenceId: booking._id, userId,
    });
  }

  booking.status = 'cancelled';
  await booking.save();
  return booking;
}

module.exports = { bookPackage, listBookings, finalizeBooking, cancelBooking };
