/**
 * FuelShiftService — meter-reading-derived sales. The genuinely new
 * mechanic: litresSold is computed, never entered. openShift() captures
 * the dispenser's current cumulative reading; closeShift() captures it
 * again, subtracts, and bills exactly that many litres through the
 * ordinary checkout — a real, enforced invariant (closing must be >=
 * opening; the meter physically cannot run backward) rather than trusting
 * whatever number a cashier types in.
 */
const FuelDispenser = require('../models/FuelDispenser');
const FuelShift = require('../models/FuelShift');
const posSaleService = require('../../../services/posSaleService');

function createDispenser(input) {
  const { companyId, branchId, name, productId, variantId, currentMeterReading } = input;
  return FuelDispenser.create({ companyId, branchId, name, productId, variantId, currentMeterReading: currentMeterReading || 0 });
}

function listDispensers(companyId, branchId) {
  const filter = { companyId };
  if (branchId) filter.branchId = branchId;
  return FuelDispenser.find(filter);
}

/** Opens a shift — captures the meter's CURRENT reading as the baseline, whatever it happens to be, not assumed to be zero. */
async function openShift(dispenserId, { pricePerLitre, userId }) {
  const dispenser = await FuelDispenser.findById(dispenserId);
  if (!dispenser) throw new Error('Dispenser not found.');

  const openShiftExists = await FuelShift.findOne({ dispenserId, status: 'open' });
  if (openShiftExists) throw new Error('This dispenser already has an open shift — close it before opening another.');

  return FuelShift.create({
    companyId: dispenser.companyId, branchId: dispenser.branchId, dispenserId,
    openingReading: dispenser.currentMeterReading, pricePerLitre,
  });
}

function listShifts(companyId, { status, dispenserId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (dispenserId) filter.dispenserId = dispenserId;
  return FuelShift.find(filter).populate('dispenserId', 'name').sort({ createdAt: -1 });
}

/**
 * Closes a shift — the closing reading MUST be >= the opening reading
 * (the meter cannot go backward; a lower number is a data-entry mistake,
 * not a real event, same principle Service Station's odometer check
 * already established for mileage). litresSold = closing - opening, billed
 * through the ordinary checkout as a real sale.
 */
async function closeShift(shiftId, { closingReading, warehouseId, customerId, paymentAccountId, billingProductId, billingVariantId, posTerminalId, userId }) {
  const shift = await FuelShift.findById(shiftId);
  if (!shift) throw new Error('Shift not found.');
  if (shift.status !== 'open') throw new Error(`Cannot close a shift with status "${shift.status}".`);
  if (closingReading < shift.openingReading) {
    throw new Error(`Closing reading (${closingReading}) cannot be less than the opening reading (${shift.openingReading}) — a fuel meter never runs backward; check for a data-entry mistake.`);
  }

  const litresSold = Math.round((closingReading - shift.openingReading) * 1000) / 1000;
  const totalAmount = Math.round(litresSold * shift.pricePerLitre * 100) / 100;

  const payments = litresSold > 0 && paymentAccountId ? [{ paymentAccountId, method: 'cash', amount: totalAmount }] : [];
  let sale = null;
  if (litresSold > 0) {
    sale = await posSaleService.checkout({
      companyId: shift.companyId, branchId: shift.branchId, warehouseId, customerId, posTerminalId, userId,
      items: [{ productId: billingProductId, variantId: billingVariantId, quantity: litresSold, unitPrice: shift.pricePerLitre }],
      payments,
    });
  }

  shift.closingReading = closingReading;
  shift.litresSold = litresSold;
  shift.status = 'closed';
  if (sale) shift.saleId = sale._id;
  await shift.save();

  // The dispenser's own running total advances to the new closing
  // reading, becoming the baseline the NEXT shift opens from — the
  // meter never resets, it just keeps climbing across every shift, forever.
  await FuelDispenser.findByIdAndUpdate(shift.dispenserId, { currentMeterReading: closingReading });

  return { shift, litresSold, totalAmount, sale };
}

module.exports = { createDispenser, listDispensers, openShift, listShifts, closeShift };
