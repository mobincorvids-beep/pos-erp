const PurchaseOrder = require('../../../models/PurchaseOrder');
const GoodsReceivedNote = require('../../../models/GoodsReceivedNote');
const Supplier = require('../../../models/Supplier');

/**
 * Built entirely from data that already exists on PurchaseOrder and
 * GoodsReceivedNote — deliberately not a new "expected delivery date"
 * field bolted onto the shared PurchaseOrder schema just for this report
 * (that's core, used by every industry; a field only Retail cares about
 * doesn't belong there). What IS available and genuinely meaningful:
 * lead time (PO placed → first goods actually received), fulfillment
 * rate (ordered vs received quantity), and defect rate (QC pass/fail on
 * received lines) — three real signals procurement already tracks
 * mentally, now computed instead of guessed.
 */
async function supplierScorecard(companyId, { fromDate, toDate } = {}) {
  const poFilter = { companyId };
  if (fromDate || toDate) {
    poFilter.createdAt = {};
    if (fromDate) poFilter.createdAt.$gte = new Date(fromDate);
    if (toDate) poFilter.createdAt.$lte = new Date(toDate);
  }
  const purchaseOrders = await PurchaseOrder.find(poFilter).lean();
  if (purchaseOrders.length === 0) return [];

  const poIds = purchaseOrders.map((po) => po._id);
  const grns = await GoodsReceivedNote.find({ purchaseOrderId: { $in: poIds } }).lean();
  const grnsByPo = new Map();
  for (const grn of grns) {
    const key = String(grn.purchaseOrderId);
    if (!grnsByPo.has(key)) grnsByPo.set(key, []);
    grnsByPo.get(key).push(grn);
  }

  const bySupplier = new Map();
  for (const po of purchaseOrders) {
    const key = String(po.supplierId);
    if (!bySupplier.has(key)) {
      bySupplier.set(key, {
        supplierId: po.supplierId, poCount: 0, totalValue: 0,
        leadTimeSamples: [], qcPassed: 0, qcFailed: 0,
        quantityOrdered: 0, quantityReceived: 0,
      });
    }
    const agg = bySupplier.get(key);
    agg.poCount += 1;
    agg.totalValue += po.items.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0);
    for (const item of po.items) {
      agg.quantityOrdered += item.quantityOrdered;
      agg.quantityReceived += item.quantityReceived;
    }

    const poGrns = grnsByPo.get(String(po._id)) || [];
    if (poGrns.length > 0) {
      const firstReceivedAt = poGrns.reduce((min, g) => (g.createdAt < min ? g.createdAt : min), poGrns[0].createdAt);
      const leadDays = (new Date(firstReceivedAt) - new Date(po.createdAt)) / (1000 * 60 * 60 * 24);
      agg.leadTimeSamples.push(leadDays);
    }
    for (const grn of poGrns) {
      for (const line of grn.items) {
        if (line.qcStatus === 'passed') agg.qcPassed += 1;
        else if (line.qcStatus === 'failed') agg.qcFailed += 1;
      }
    }
  }

  const supplierIds = Array.from(bySupplier.keys());
  const suppliers = await Supplier.find({ _id: { $in: supplierIds } }).select('name').lean();
  const nameById = new Map(suppliers.map((s) => [String(s._id), s.name]));

  return Array.from(bySupplier.entries()).map(([id, agg]) => {
    const avgLeadDays = agg.leadTimeSamples.length
      ? Math.round((agg.leadTimeSamples.reduce((a, b) => a + b, 0) / agg.leadTimeSamples.length) * 10) / 10
      : null;
    const fulfillmentRate = agg.quantityOrdered > 0 ? Math.round((agg.quantityReceived / agg.quantityOrdered) * 1000) / 10 : null;
    const qcTotal = agg.qcPassed + agg.qcFailed;
    const defectRate = qcTotal > 0 ? Math.round((agg.qcFailed / qcTotal) * 1000) / 10 : null;
    return {
      supplierId: id, supplierName: nameById.get(id) || 'Unknown supplier',
      poCount: agg.poCount, totalValue: Math.round(agg.totalValue * 100) / 100,
      avgLeadDays, fulfillmentRate, defectRate,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);
}

module.exports = { supplierScorecard };
