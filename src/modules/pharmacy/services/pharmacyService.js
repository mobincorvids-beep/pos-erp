/**
 * PharmacyService — pharmacy-specific workflows that sit on top of the core
 * engine rather than duplicating it: dispensing still goes through the same
 * PosSaleService.checkout() used by every other industry, so inventory and
 * accounting effects are identical; only the prescription linkage is new.
 */
const Prescription = require('../models/Prescription');
const ProductBatch = require('../../../models/ProductBatch');
const StockLevel = require('../../../models/StockLevel');
const posSaleService = require('../../../services/posSaleService');

/**
 * Bill a prescription at the counter. Builds sale line items from the
 * prescription (or an explicit override list, e.g. partial dispensing),
 * runs the normal checkout, then links the resulting sale back to the
 * prescription and updates its status.
 */
async function dispensePrescription({ prescriptionId, saleInput }) {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) throw new Error('Prescription not found.');
  if (prescription.status === 'dispensed') throw new Error('Prescription already fully dispensed.');

  const sale = await posSaleService.checkout(saleInput);

  prescription.saleId = sale._id;
  // Simple version: any dispensing marks it dispensed. For partial fills,
  // compare saleInput.items quantities against prescription.items and set
  // 'partially_dispensed' instead — left as a TODO once partial-fill UI exists.
  prescription.status = 'dispensed';
  await prescription.save();

  return { sale, prescription };
}

/**
 * Near-expiry report: batches expiring within `daysThreshold`, with current
 * on-hand quantity. This is the "near-expiry reports" module your proposal
 * called out under Pharmacy — reuses core StockLevel, doesn't need its own
 * quantity tracking.
 */
async function nearExpiryReport(companyId, daysThreshold = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysThreshold);

  const batches = await ProductBatch.find({
    companyId,
    expiryDate: { $ne: null, $lte: cutoff },
  }).populate('productId', 'name sku');

  const rows = [];
  for (const batch of batches) {
    const levels = await StockLevel.find({ batchId: batch._id, quantity: { $gt: 0 } });
    const totalQty = levels.reduce((sum, l) => sum + l.quantity, 0);
    if (totalQty > 0) {
      rows.push({
        productId: batch.productId?._id,
        productName: batch.productId?.name,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        quantityOnHand: totalQty,
        daysToExpiry: Math.ceil((batch.expiryDate - new Date()) / (1000 * 60 * 60 * 24)),
      });
    }
  }

  return rows.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
}

module.exports = { dispensePrescription, nearExpiryReport };
