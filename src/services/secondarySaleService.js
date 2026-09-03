/**
 * SecondarySaleService — records what a retailer/shop (Customer) reported
 * selling onward, per product per period. Plain CRUD plus a summary
 * grouped by product/period — deliberately not linked to any inventory or
 * accounting effect, this is reported data, not a transaction.
 */
const SecondarySale = require('../models/SecondarySale');

function upsert(companyId, userId, input) {
  const { customerId, productId, period, quantitySold, note } = input;
  if (!customerId || !productId || !period) throw new Error('customerId, productId and period are required.');
  if (quantitySold === undefined || quantitySold < 0) throw new Error('quantitySold must be zero or greater.');

  // One row per customer/product/period — re-recording the same period
  // corrects it rather than creating a duplicate (unique index on the model).
  return SecondarySale.findOneAndUpdate(
    { companyId, customerId, productId, period },
    { companyId, customerId, productId, period, quantitySold, note, recordedByUserId: userId },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
}

function list(companyId, filter = {}) {
  const query = { companyId };
  if (filter.customerId) query.customerId = filter.customerId;
  if (filter.productId) query.productId = filter.productId;
  if (filter.period) query.period = filter.period;
  return SecondarySale.find(query).sort({ period: -1 }).populate('customerId', 'name').populate('productId', 'name');
}

function remove(companyId, id) {
  return SecondarySale.findOneAndDelete({ _id: id, companyId });
}

/** Sell-through totals per product for a given period, across all customers who reported it. */
async function summaryByPeriod(companyId, period) {
  const rows = await SecondarySale.find({ companyId, period }).populate('productId', 'name');
  const byProduct = new Map();
  for (const row of rows) {
    const key = String(row.productId?._id || row.productId);
    if (!byProduct.has(key)) {
      byProduct.set(key, { productId: row.productId?._id || row.productId, productName: row.productId?.name || '—', totalQuantitySold: 0, reportingCustomers: 0 });
    }
    const entry = byProduct.get(key);
    entry.totalQuantitySold += row.quantitySold;
    entry.reportingCustomers += 1;
  }
  return Array.from(byProduct.values()).sort((a, b) => b.totalQuantitySold - a.totalQuantitySold);
}

module.exports = { upsert, list, remove, summaryByPeriod };
