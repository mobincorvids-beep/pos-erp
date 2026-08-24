/**
 * ToolRentalService — equipment loans with a deposit and a condition-based
 * return outcome. checkOutRental() reuses the exact Dr-Cash/Cr-Liability
 * deposit pattern Hotel and Banquet established. What's genuinely new is
 * returnRental(): a three-way branch on the item's ASSESSED CONDITION,
 * where each branch produces a different combination of (a) how much
 * deposit comes back, (b) how much becomes recognized revenue, and (c)
 * whether the item ever returns to sellable stock at all — three
 * independent outcomes from one input, not a single percentage like
 * Banquet's cancellation.
 */
const mongoose = require('mongoose');
const RentalAgreement = require('../models/RentalAgreement');
const inventoryService = require('../../../services/inventoryService');
const posSaleService = require('../../../services/posSaleService');
const accountingService = require('../../../services/accountingService');

/** Item leaves the shelf for real — a genuine stock deduction, since it's physically not there to sell to anyone else while it's out, exactly like a sale would remove it, just without a Sale document (nothing has been sold). */
async function checkOutRental(input) {
  const {
    companyId, branchId, warehouseId, productId, variantId, customerId,
    quantity, dailyRate, expectedReturnDate, depositAmount,
    depositReceivedInAccountId, depositLiabilityAccountId,
    rentalBillingProductId, rentalBillingVariantId, userId,
  } = input;
  if (!dailyRate || !depositAmount) throw new Error('dailyRate and depositAmount are required.');
  if (!rentalBillingProductId || !rentalBillingVariantId) throw new Error('rentalBillingProductId and rentalBillingVariantId are required — must be a Product with trackingMode "service", since the rental usage charge (days × dailyRate) is billed through the ordinary checkout at return time, same as every other module in this app.');

  const session = await mongoose.startSession();
  try {
    let agreement;
    await session.withTransaction(async () => {
      await inventoryService.assertSufficientStock(warehouseId, variantId, null, quantity || 1);

      [agreement] = await RentalAgreement.create(
        [{
          companyId, branchId, warehouseId, productId, variantId, customerId,
          quantity: quantity || 1, dailyRate, expectedReturnDate, depositAmount,
          depositReceivedInAccountId, depositLiabilityAccountId,
          rentalBillingProductId, rentalBillingVariantId,
        }],
        { session }
      );

      await inventoryService.recordMovement({
        companyId, warehouseId, productId, variantId,
        type: 'adjustment', quantity: -(quantity || 1),
        referenceType: 'RentalAgreement', referenceId: agreement._id, userId,
        note: 'Equipment checked out on rental — temporarily off the shelf',
      }, session);

      await accountingService.postVoucher({
        companyId, branchId, type: 'receipt', narration: 'Rental security deposit received',
        entries: [
          { accountId: depositReceivedInAccountId, debit: depositAmount, credit: 0 },
          { accountId: depositLiabilityAccountId, debit: 0, credit: depositAmount },
        ],
        referenceType: 'RentalAgreement', referenceId: agreement._id, userId,
      }, session);
    });
    return agreement;
  } finally {
    session.endSession();
  }
}

function listRentals(companyId, { status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return RentalAgreement.find(filter).populate('customerId', 'name').populate('productId', 'name').sort({ checkOutDate: -1 });
}

/** Was missing — a mistaken checkout (wrong item, wrong customer) had no way back: the item
 * stayed permanently "out" of stock and the deposit liability stayed permanently open, with
 * no return possible. Only allowed while still 'out' — once returnRental() has run, this is a
 * closed transaction with its own real accounting (deposit refund/forfeit, revenue), same
 * "correct forward, not backward" rule as Sale. Reverses both real effects of checkout:
 * restocks the item and reverses the deposit-received voucher. */
async function voidRental(companyId, rentalId, { userId }) {
  const session = await mongoose.startSession();
  try {
    let agreement;
    await session.withTransaction(async () => {
      agreement = await RentalAgreement.findOne({ _id: rentalId, companyId }).session(session);
      if (!agreement) throw new Error('Rental agreement not found.');
      if (agreement.status !== 'out') throw new Error(`Cannot void a rental that is already "${agreement.status}".`);

      await inventoryService.recordMovement({
        companyId, warehouseId: agreement.warehouseId, productId: agreement.productId, variantId: agreement.variantId,
        type: 'adjustment', quantity: agreement.quantity,
        referenceType: 'RentalAgreement', referenceId: agreement._id, userId,
        note: 'Rental checkout voided — item back on the shelf',
      }, session);

      await accountingService.postVoucher({
        companyId, branchId: agreement.branchId, type: 'receipt', narration: 'Rental voided — security deposit reversed',
        entries: [
          { accountId: agreement.depositLiabilityAccountId, debit: agreement.depositAmount, credit: 0 },
          { accountId: agreement.depositReceivedInAccountId, debit: 0, credit: agreement.depositAmount },
        ],
        referenceType: 'RentalAgreement', referenceId: agreement._id, userId,
      }, session);

      agreement.status = 'cancelled';
      await agreement.save({ session });
    });
    return agreement;
  } finally {
    session.endSession();
  }
}

/**
 * The condition-based branch — three genuinely different outcomes from
 * one input:
 *   'good'                -> full deposit refund, item restocked (sellable/rentable again)
 *   'minor_damage'        -> partial refund (forfeitPercent of the deposit becomes damage-repair revenue), item STILL restocked (assumed repairable/usable)
 *   'lost_or_major_damage'-> deposit fully forfeited as revenue, item NEVER restocked (gone for good)
 * Plus a separate, ordinary rental usage charge (days × dailyRate) billed
 * through the normal checkout regardless of condition — the deposit's
 * fate and the rental charge are two independent things, not the same money.
 */
async function returnRental(rentalId, {
  condition, actualReturnDate, warehouseId, finalPaymentAccountId,
  damageRevenueAccountId, forfeitPercentForMinorDamage, userId,
}) {
  const validConditions = ['good', 'minor_damage', 'lost_or_major_damage'];
  if (!validConditions.includes(condition)) throw new Error(`condition must be one of: ${validConditions.join(', ')}.`);
  // Required regardless of condition — it's where any deposit refund is
  // paid FROM (an asset account decreasing) and where the rental usage
  // charge is collected TO, not just relevant to the 'good' branch.
  if (!finalPaymentAccountId) throw new Error('finalPaymentAccountId is required — used both for any deposit refund and for collecting the rental usage charge.');

  const agreement = await RentalAgreement.findById(rentalId);
  if (!agreement) throw new Error('Rental agreement not found.');
  if (agreement.status !== 'out') throw new Error(`Cannot return an agreement with status "${agreement.status}".`);

  const returnDate = actualReturnDate ? new Date(actualReturnDate) : new Date();
  const days = Math.max(1, Math.ceil((returnDate - agreement.checkOutDate) / (1000 * 60 * 60 * 24)));
  const rentalCharge = Math.round(days * agreement.dailyRate * 100) / 100;

  // --- The three-way branch ---
  let depositRefunded = 0;
  let depositForfeited = 0;
  let restocked = false;
  const voucherEntries = [{ accountId: agreement.depositLiabilityAccountId, debit: agreement.depositAmount, credit: 0 }]; // the liability clears in FULL regardless of branch — the obligation to hold the deposit is over either way

  if (condition === 'good') {
    depositRefunded = agreement.depositAmount;
    restocked = true;
    voucherEntries.push({ accountId: finalPaymentAccountId, debit: 0, credit: depositRefunded });
  } else if (condition === 'minor_damage') {
    const pct = Math.max(0, Math.min(100, forfeitPercentForMinorDamage ?? 50));
    depositForfeited = Math.round(agreement.depositAmount * (pct / 100) * 100) / 100;
    depositRefunded = Math.round((agreement.depositAmount - depositForfeited) * 100) / 100;
    restocked = true; // assumed repairable — still usable, unlike major damage/loss
    if (depositForfeited > 0) {
      if (!damageRevenueAccountId) throw new Error('damageRevenueAccountId is required when any portion of the deposit is forfeited for damage.');
      voucherEntries.push({ accountId: damageRevenueAccountId, debit: 0, credit: depositForfeited });
    }
    if (depositRefunded > 0) voucherEntries.push({ accountId: finalPaymentAccountId, debit: 0, credit: depositRefunded });
  } else {
    // lost_or_major_damage
    depositForfeited = agreement.depositAmount;
    restocked = false; // never comes back — gone for good
    if (!damageRevenueAccountId) throw new Error('damageRevenueAccountId is required when the deposit is fully forfeited.');
    voucherEntries.push({ accountId: damageRevenueAccountId, debit: 0, credit: depositForfeited });
  }

  // Deliberately NOT wrapped in one enclosing transaction around the
  // checkout() call below — the same structural choice Hotel's own
  // checkOut() already made (see that file's comments): posSaleService.
  // checkout() always opens its OWN independent session internally and
  // has no way to join an outer one, so nesting a second transaction
  // around it wouldn't actually make the whole function atomic, it would
  // just create two unrelated transactions that happen to overlap in
  // time — worse than not pretending to, since it would look safe without
  // being safe. Each step below is its own real atomic unit instead
  // (a single voucher, a single stock movement, one real Sale via
  // checkout's own transaction), matching the trade-off Hotel/Banquet/
  // School all already made and shipped.
  const voucher = await accountingService.postVoucher({
    companyId: agreement.companyId, branchId: agreement.branchId, type: 'journal',
    narration: `Rental return — condition: ${condition}`,
    entries: voucherEntries,
    referenceType: 'RentalAgreement', referenceId: agreement._id, userId,
  });

  if (restocked) {
    await inventoryService.recordMovement({
      companyId: agreement.companyId, warehouseId: agreement.warehouseId,
      productId: agreement.productId, variantId: agreement.variantId,
      type: 'adjustment', quantity: agreement.quantity,
      referenceType: 'RentalAgreement', referenceId: agreement._id, userId,
      note: `Returned from rental — condition: ${condition}`,
    });
  }

  const sale = await posSaleService.checkout({
    companyId: agreement.companyId, branchId: agreement.branchId, warehouseId: warehouseId || agreement.warehouseId,
    customerId: agreement.customerId, userId,
    items: [{ productId: agreement.rentalBillingProductId, variantId: agreement.rentalBillingVariantId, quantity: days, unitPrice: agreement.dailyRate }],
    payments: [{ paymentAccountId: finalPaymentAccountId, method: 'cash', amount: rentalCharge }],
  });

  agreement.status = 'returned';
  agreement.actualReturnDate = returnDate;
  agreement.condition = condition;
  agreement.rentalCharge = rentalCharge;
  agreement.depositRefunded = depositRefunded;
  agreement.depositForfeited = depositForfeited;
  agreement.restocked = restocked;
  agreement.voucherId = voucher._id;
  agreement.saleId = sale._id;
  await agreement.save();

  return agreement;
}

module.exports = { checkOutRental, listRentals, voidRental, returnRental };
