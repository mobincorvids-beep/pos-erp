/**
 * SupplierScorecardService — read-only procurement KPIs per supplier:
 *
 *  - On-time delivery %: for every GRN raised against a PO from this
 *    supplier, compare the GRN's receivedDate to the PO's expectedDate
 *    (falls back to orderDate + supplier.leadTimeDays when the PO has no
 *    explicit expectedDate — same lead-time convention reorderRuleService
 *    already relies on). "On time" = receivedDate <= expected.
 *  - Price variance %: for each GRN line, how far its unitCost sits from
 *    a rolling average of this supplier's own historical price for that
 *    exact product+variant (computed from every GRN line for that
 *    supplier/product prior to — and including — the GRN being scored, so
 *    the average itself evolves as more receipts come in rather than
 *    being one fixed number).
 *  - QC pass rate: fraction of GRN lines with qcStatus 'passed' out of
 *    every line that's been decided (passed + failed; 'pending' lines are
 *    excluded from the denominator since they haven't been decided yet).
 *
 * Entirely read-only — no writes, safe to call as often as needed.
 */
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceivedNote = require('../models/GoodsReceivedNote');
const Supplier = require('../models/Supplier');

function poExpectedDate(po, supplierLeadTimeDays) {
  if (po.expectedDate) return new Date(po.expectedDate);
  // Older POs created before expectedDate existed have none stored —
  // fall back to the supplier's CURRENT lead time as a best-effort proxy.
  const base = new Date(po.orderDate || po.createdAt);
  base.setDate(base.getDate() + (supplierLeadTimeDays || 0));
  return base;
}

/**
 * @param {String} companyId
 * @param {String} supplierId
 * @param {Object} [range]
 * @param {Date|String} [range.from]
 * @param {Date|String} [range.to]
 */
async function getSupplierScorecard(companyId, supplierId, { from, to } = {}) {
  const supplier = await Supplier.findOne({ _id: supplierId, companyId });
  if (!supplier) throw new Error('Supplier not found.');

  const pos = await PurchaseOrder.find({ companyId, supplierId }).lean();
  const poById = new Map(pos.map((po) => [String(po._id), po]));
  const poIds = pos.map((po) => po._id);
  if (poIds.length === 0) {
    return emptyScorecard(supplier);
  }

  const grnFilter = { companyId, purchaseOrderId: { $in: poIds } };
  if (from || to) {
    grnFilter.receivedDate = {};
    if (from) grnFilter.receivedDate.$gte = new Date(from);
    if (to) grnFilter.receivedDate.$lte = new Date(to);
  }
  const grns = await GoodsReceivedNote.find(grnFilter).sort({ receivedDate: 1 }).lean();

  let onTimeCount = 0;
  let deliveryCount = 0;
  let qcPassed = 0;
  let qcDecided = 0;
  let varianceSum = 0;
  let varianceCount = 0;

  // Running per-product price history for this supplier, built up in
  // chronological GRN order so each GRN's variance is computed against
  // the average that existed strictly BEFORE it (a genuinely rolling
  // average, not a look-ahead one).
  const priceHistory = new Map(); // key: `${productId}:${variantId}` -> { sum, count }

  for (const grn of grns) {
    const po = poById.get(String(grn.purchaseOrderId));
    if (po) {
      deliveryCount += 1;
      const expected = poExpectedDate(po, supplier.leadTimeDays);
      if (new Date(grn.receivedDate) <= expected) onTimeCount += 1;
    }

    for (const line of grn.items || []) {
      if (line.qcStatus === 'passed') { qcPassed += 1; qcDecided += 1; }
      else if (line.qcStatus === 'failed') { qcDecided += 1; }

      const key = `${line.productId}:${line.variantId}`;
      const hist = priceHistory.get(key);
      if (hist && hist.count > 0) {
        const rollingAvg = hist.sum / hist.count;
        if (rollingAvg > 0) {
          varianceSum += Math.abs(line.unitCost - rollingAvg) / rollingAvg;
          varianceCount += 1;
        }
      }
      const next = hist || { sum: 0, count: 0 };
      next.sum += line.unitCost;
      next.count += 1;
      priceHistory.set(key, next);
    }
  }

  return {
    supplierId: supplier._id,
    supplierName: supplier.name,
    grnCount: grns.length,
    onTimeDeliveryPercent: deliveryCount > 0 ? Math.round((onTimeCount / deliveryCount) * 10000) / 100 : null,
    deliveriesConsidered: deliveryCount,
    qcPassRatePercent: qcDecided > 0 ? Math.round((qcPassed / qcDecided) * 10000) / 100 : null,
    qcLinesConsidered: qcDecided,
    avgPriceVariancePercent: varianceCount > 0 ? Math.round((varianceSum / varianceCount) * 10000) / 100 : null,
    priceLinesConsidered: varianceCount,
  };
}

function emptyScorecard(supplier) {
  return {
    supplierId: supplier._id,
    supplierName: supplier.name,
    grnCount: 0,
    onTimeDeliveryPercent: null,
    deliveriesConsidered: 0,
    qcPassRatePercent: null,
    qcLinesConsidered: 0,
    avgPriceVariancePercent: null,
    priceLinesConsidered: 0,
  };
}

/** Ranked list of every supplier's scorecard for this company, sorted best-on-time-first (nulls last). */
async function getAllSupplierScorecards(companyId, { from, to } = {}) {
  const suppliers = await Supplier.find({ companyId }).lean();
  const cards = [];
  for (const supplier of suppliers) {
    // eslint-disable-next-line no-await-in-loop -- suppliers are a per-company, bounded, admin-facing list; sequential is fine and keeps this simple to reason about
    cards.push(await getSupplierScorecard(companyId, supplier._id, { from, to }));
  }
  cards.sort((a, b) => (b.onTimeDeliveryPercent ?? -1) - (a.onTimeDeliveryPercent ?? -1));
  return cards;
}

module.exports = { getSupplierScorecard, getAllSupplierScorecards };
