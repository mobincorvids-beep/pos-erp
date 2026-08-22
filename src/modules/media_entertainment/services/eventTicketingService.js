/**
 * EventTicketingService — Gym's exact capacity+waitlist transaction shape
 * (read the current state inside a transaction, check capacity, either
 * fill the seat or waitlist), but applied per TIER rather than to the
 * whole event — the genuinely new part. A sold-out VIP tier and a
 * half-empty Standard tier on the same show are independent; someone
 * waitlisted for VIP is never silently offered a Standard seat.
 */
const mongoose = require('mongoose');
const EventShow = require('../models/EventShow');
const posSaleService = require('../../../services/posSaleService');

function createShow(input) {
  const { companyId, branchId, eventName, showDateTime, tiers } = input;
  if (!tiers || tiers.length === 0) throw new Error('At least one seating tier is required.');
  return EventShow.create({ companyId, branchId, eventName, showDateTime, tiers });
}

function listShows(companyId, { status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return EventShow.find(filter).sort({ showDateTime: 1 });
}

/**
 * Books into ONE specific tier — checked and filled/waitlisted against
 * THAT tier's own capacity only, never the show's other tiers. A real
 * ticket sale bills through checkout at the TIER'S price, not some
 * average or the show's "base" price — there is no single event price,
 * only per-tier prices, since that's genuinely what a tiered show is.
 */
async function bookTicket(showId, tierId, { customerId, warehouseId, ticketBillingProductId, ticketBillingVariantId, paymentAccountId, posTerminalId, userId }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const show = await EventShow.findById(showId).session(session);
      if (!show) throw new Error('Show not found.');
      if (show.status !== 'scheduled') throw new Error(`Cannot book a show with status "${show.status}".`);

      const tier = show.tiers.id(tierId);
      if (!tier) throw new Error('Seating tier not found on this show.');
      if (tier.soldCustomerIds.some((id) => String(id) === String(customerId))) throw new Error('This customer already has a ticket in this tier.');
      if (tier.waitlistCustomerIds.some((id) => String(id) === String(customerId))) throw new Error('This customer is already on the waitlist for this tier.');

      if (tier.soldCustomerIds.length < tier.capacity) {
        tier.soldCustomerIds.push(customerId);
        await show.save({ session });
        result = { booked: true, waitlisted: false, tierName: tier.name, price: tier.price };
      } else {
        tier.waitlistCustomerIds.push(customerId);
        await show.save({ session });
        result = { booked: false, waitlisted: true, tierName: tier.name, waitlistPosition: tier.waitlistCustomerIds.length };
      }
    });
  } finally {
    session.endSession();
  }

  if (!result.booked) return result;

  // The real ticket sale — billed at whatever THIS tier's price is, done
  // as its own step outside the transaction above (an external checkout()
  // call has no business holding a database transaction open, the same
  // lesson this app already applied to Hardware's and Multi-Currency's
  // checkout integrations).
  const refreshed = await EventShow.findById(showId);
  const tier = refreshed.tiers.id(tierId);
  const sale = await posSaleService.checkout({
    companyId: refreshed.companyId, branchId: refreshed.branchId, warehouseId, customerId, posTerminalId, userId,
    items: [{ productId: ticketBillingProductId, variantId: ticketBillingVariantId, quantity: 1, unitPrice: tier.price }],
    payments: [{ paymentAccountId, method: 'cash', amount: tier.price }],
  });
  return { ...result, sale };
}

/**
 * Cancels a ticket in one tier — promotes THAT SAME TIER'S longest-
 * waiting person (never a different tier's waitlist), and bills them at
 * the tier's CURRENT price, not whatever price was in effect when they
 * originally joined the waitlist — a real, honest detail: prices can
 * change between when someone joins a waitlist and when a seat actually
 * opens up, and what they're charged should reflect the price now, the
 * same principle Fashion's markdown pricing already established
 * (the price is whatever the current rules say, not a locked-in historical one).
 */
async function cancelTicket(showId, tierId, customerId, { warehouseId, ticketBillingProductId, ticketBillingVariantId, refundAccountId, userId }) {
  const session = await mongoose.startSession();
  let promotedCustomerId;
  try {
    await session.withTransaction(async () => {
      const show = await EventShow.findById(showId).session(session);
      if (!show) throw new Error('Show not found.');

      const tier = show.tiers.id(tierId);
      if (!tier) throw new Error('Seating tier not found on this show.');

      const idx = tier.soldCustomerIds.findIndex((id) => String(id) === String(customerId));
      if (idx === -1) throw new Error('This customer does not have a ticket in this tier.');
      tier.soldCustomerIds.splice(idx, 1);

      if (tier.waitlistCustomerIds.length > 0) {
        promotedCustomerId = tier.waitlistCustomerIds.shift();
        tier.soldCustomerIds.push(promotedCustomerId);
      }

      await show.save({ session });
    });
  } finally {
    session.endSession();
  }

  let promotedSale = null;
  if (promotedCustomerId) {
    const refreshed = await EventShow.findById(showId);
    const tier = refreshed.tiers.id(tierId);
    promotedSale = await posSaleService.checkout({
      companyId: refreshed.companyId, branchId: refreshed.branchId, warehouseId, customerId: promotedCustomerId, userId,
      items: [{ productId: ticketBillingProductId, variantId: ticketBillingVariantId, quantity: 1, unitPrice: tier.price }],
      payments: refundAccountId ? [{ paymentAccountId: refundAccountId, method: 'cash', amount: tier.price }] : [],
    });
  }

  return { promotedCustomerId: promotedCustomerId || null, promotedSale };
}

function showRoster(showId) {
  return EventShow.findById(showId).populate('tiers.soldCustomerIds', 'name').populate('tiers.waitlistCustomerIds', 'name');
}

module.exports = { createShow, listShows, bookTicket, cancelTicket, showRoster };
