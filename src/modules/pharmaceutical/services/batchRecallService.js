/**
 * BatchRecallService — the genuinely new mechanic: initiateRecall()
 * doesn't ask anyone to remember who bought a defective batch, it FINDS
 * OUT, by aggregating every real Sale whose items reference this exact
 * batchId, grouped by customer. This is a real trace across historical
 * transactions that nothing else in this app does — every other
 * batch-related feature (Pharmacy's near-expiry report, Grocery's FEFO
 * picking) looks at CURRENT stock, never at where stock already WENT.
 *
 * Scope, stated honestly: this traces and tracks returns. It does NOT
 * modify posSaleService.checkout() to actively BLOCK future sales of a
 * recalled batch — that's a real, separate, riskier change touching the
 * single most heavily-exercised function in this entire project, and
 * wasn't attempted here rather than risk it for a first version.
 */
const mongoose = require('mongoose');
const Sale = require('../../../models/Sale');
const BatchRecall = require('../models/BatchRecall');

/** The real trace — aggregates every Sale whose items reference this batch, grouped by customer, to find out who actually received units of it. */
async function initiateRecall({ companyId, batchId, productId, reason, userId }) {
  const affected = await Sale.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), 'items.batchId': new mongoose.Types.ObjectId(batchId) } },
    { $unwind: '$items' },
    { $match: { 'items.batchId': new mongoose.Types.ObjectId(batchId) } },
    { $group: { _id: '$customerId', quantitySold: { $sum: '$items.quantity' } } },
  ]);

  const affectedCustomers = affected
    .filter((row) => row._id) // exclude sales with no customer on file (walk-in) — nobody to trace or notify
    .map((row) => ({ customerId: row._id, quantitySold: row.quantitySold, quantityReturned: 0 }));

  return BatchRecall.create({ companyId, batchId, productId, reason, affectedCustomers });
}

function listRecalls(companyId, { status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return BatchRecall.find(filter).populate('productId', 'name').sort({ initiatedDate: -1 });
}

/** Records a return against one affected customer — checked against how much THAT SPECIFIC customer actually received, so a return can never be recorded beyond what real Sale history shows they got. */
async function recordReturn(recallId, { customerId, quantity }) {
  if (!quantity || quantity <= 0) throw new Error('quantity must be greater than zero.');
  const recall = await BatchRecall.findById(recallId);
  if (!recall) throw new Error('Recall not found.');

  const entry = recall.affectedCustomers.find((c) => String(c.customerId) === String(customerId));
  if (!entry) throw new Error('This customer never received units of this recalled batch, according to real sales history.');

  const remaining = entry.quantitySold - entry.quantityReturned;
  if (quantity > remaining) throw new Error(`This customer only has ${remaining} units of this batch still outstanding (${entry.quantitySold} sold, ${entry.quantityReturned} already returned) — cannot record a return of ${quantity}.`);

  entry.quantityReturned += quantity;
  await recall.save();
  return recall;
}

/** Real progress, not a guess — the actual sum across every affected customer, and exactly who's still outstanding. */
function recallProgress(recall) {
  const totalSold = recall.affectedCustomers.reduce((sum, c) => sum + c.quantitySold, 0);
  const totalReturned = recall.affectedCustomers.reduce((sum, c) => sum + c.quantityReturned, 0);
  const outstandingCustomers = recall.affectedCustomers.filter((c) => c.quantitySold > c.quantityReturned);
  return { totalSold, totalReturned, outstandingCount: outstandingCustomers.length, outstandingCustomers, percentComplete: totalSold > 0 ? Math.round((totalReturned / totalSold) * 10000) / 100 : 100 };
}

async function getRecall(recallId) {
  const recall = await BatchRecall.findById(recallId).populate('affectedCustomers.customerId', 'name').populate('productId', 'name');
  if (!recall) throw new Error('Recall not found.');
  return { recall, progress: recallProgress(recall) };
}

async function closeRecall(recallId) {
  const recall = await BatchRecall.findById(recallId);
  if (!recall) throw new Error('Recall not found.');
  recall.status = 'closed';
  await recall.save();
  return recall;
}

module.exports = { initiateRecall, listRecalls, recordReturn, getRecall, closeRecall };
