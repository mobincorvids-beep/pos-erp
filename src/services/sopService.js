/**
 * SopService — Sales & Operations Planning cycle. Reconciles the
 * statistical demand forecast (demandForecastService, already built)
 * against known open supply (open PO quantities) into a per-product,
 * per-period consensus plan, then routes that consensus through the same
 * generic ApprovalRequest engine every other approval flow in this app
 * uses (requisitions, POs, supplier onboarding) — no new sign-off
 * mechanism invented here.
 *
 * Flow: generateCycle() (draft, one row per product from the statistical
 * forecast) -> updateLine() (planners adjust consensus numbers) ->
 * submitForReview() (opens the ApprovalRequest) -> decide() (advances it,
 * same pattern as requisitionService.decide) -> once the period has
 * actually elapsed, closeCycle() records actuals and reports variance.
 */
const mongoose = require('mongoose');
const SopCycle = require('../models/SopCycle');
const PurchaseOrder = require('../models/PurchaseOrder');
const StockMovement = require('../models/StockMovement');
const demandForecastService = require('./demandForecastService');
const approvalService = require('./approvalService');
const auditService = require('./auditService');

/** Sum of (quantityOrdered - quantityReceived) across this product's open POs — supply already committed but not yet on hand. */
async function getOpenSupplyQty(companyId, productId) {
  const openPOs = await PurchaseOrder.find({
    companyId, status: { $in: ['ordered', 'partially_received'] }, 'items.productId': productId,
  }).select('items').lean();

  let total = 0;
  for (const po of openPOs) {
    for (const line of po.items) {
      if (String(line.productId) === String(productId)) {
        total += Math.max(0, (line.quantityOrdered || 0) - (line.quantityReceived || 0));
      }
    }
  }
  return total;
}

/**
 * Generates (or regenerates, while still 'draft') a cycle for `period`
 * ('YYYY-MM') across the given productIds — statistical forecast +
 * open-supply snapshot per product, consensus numbers seeded from the
 * statistical figures so a planner who touches nothing still gets a
 * sane plan.
 */
async function generateCycle(companyId, { period, productIds, warehouseId, historyDays = 90, forecastDays = 30, userId }) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) throw new Error('period must be in YYYY-MM format.');
  if (!productIds || !productIds.length) throw new Error('At least one productId is required.');

  let cycle = await SopCycle.findOne({ companyId, period });
  if (cycle && cycle.status !== 'draft') {
    throw new Error(`Cycle for ${period} is already "${cycle.status}" — only a draft cycle can be regenerated.`);
  }

  const lines = [];
  for (const productId of productIds) {
    const { forecastedDemand } = await demandForecastService.forecastDemand(companyId, { productId, warehouseId, historyDays, forecastDays });
    const openSupplyQty = await getOpenSupplyQty(companyId, productId);
    const statisticalForecastQty = Math.round(forecastedDemand || 0);
    lines.push({
      productId,
      statisticalForecastQty,
      openSupplyQty,
      consensusDemandQty: statisticalForecastQty,
      consensusSupplyQty: openSupplyQty,
      gapQty: statisticalForecastQty - openSupplyQty,
    });
  }

  if (cycle) {
    cycle.lines = lines;
    cycle.generatedAt = new Date();
    cycle.userId = userId;
    await cycle.save();
  } else {
    cycle = await SopCycle.create({ companyId, period, lines, userId });
  }
  return cycle;
}

/** Planner override of one line's consensus demand/supply/note — recomputes gapQty. */
async function updateLine(cycleId, productId, { consensusDemandQty, consensusSupplyQty, note }) {
  const cycle = await SopCycle.findById(cycleId);
  if (!cycle) throw new Error('S&OP cycle not found.');
  if (cycle.status !== 'draft') throw new Error(`Cannot edit a cycle that is already "${cycle.status}".`);

  const line = cycle.lines.find((l) => String(l.productId) === String(productId));
  if (!line) throw new Error('Product not found on this cycle.');

  if (consensusDemandQty != null) line.consensusDemandQty = consensusDemandQty;
  if (consensusSupplyQty != null) line.consensusSupplyQty = consensusSupplyQty;
  if (note != null) line.note = note;
  line.gapQty = line.consensusDemandQty - line.consensusSupplyQty;

  await cycle.save();
  return cycle;
}

/** Opens the ApprovalRequest for demand/supply sign-off — same engine as PurchaseOrder/PurchaseRequisition. */
async function submitForReview(cycleId, { requestedBy, note }) {
  const cycle = await SopCycle.findById(cycleId);
  if (!cycle) throw new Error('S&OP cycle not found.');
  if (cycle.status !== 'draft') throw new Error(`Cycle is already "${cycle.status}".`);

  const approval = await approvalService.request({
    companyId: cycle.companyId, entityType: 'SopCycle', entityId: cycle._id, requestedBy, note,
  });
  cycle.status = 'under_review';
  cycle.approvalRequestId = approval._id;
  await cycle.save();
  return cycle;
}

/** Advances the cycle's approval chain one step — same shape as requisitionService.decide. */
async function decide(cycleId, { approve, userId, note }) {
  const cycle = await SopCycle.findById(cycleId);
  if (!cycle) throw new Error('S&OP cycle not found.');
  if (cycle.status !== 'under_review') throw new Error(`Cycle is not under review (currently "${cycle.status}").`);

  await approvalService.decide(cycle.approvalRequestId, { approve, userId, note });

  const refreshed = await approvalService.findFor('SopCycle', cycle._id);
  if (refreshed.status !== 'pending') {
    cycle.status = refreshed.status; // 'approved' | 'rejected'
    await cycle.save();
    await auditService.record({
      companyId: cycle.companyId, userId,
      action: cycle.status === 'approved' ? 'sop_cycle.approved' : 'sop_cycle.rejected',
      entityType: 'SopCycle', entityId: cycle._id,
    });
  }
  return cycle;
}

/**
 * Closes an approved (or forcibly, any) cycle once its period has elapsed:
 * records what actually sold per product (from StockMovement, same source
 * demandForecastService itself reads) so getVariance()/history can score
 * how good the consensus number turned out to be.
 */
async function closeCycle(cycleId) {
  const cycle = await SopCycle.findById(cycleId);
  if (!cycle) throw new Error('S&OP cycle not found.');
  if (cycle.status === 'closed') return cycle;

  const [year, month] = cycle.period.split('-').map(Number);
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));

  for (const line of cycle.lines) {
    const agg = await StockMovement.aggregate([
      { $match: {
        companyId: new mongoose.Types.ObjectId(cycle.companyId),
        productId: new mongoose.Types.ObjectId(line.productId),
        type: 'sale',
        createdAt: { $gte: periodStart, $lt: periodEnd },
      } },
      { $group: { _id: null, qty: { $sum: { $abs: '$quantity' } } } },
    ]);
    line.actualSoldQty = agg[0]?.qty || 0;
  }
  cycle.status = 'closed';
  cycle.closedAt = new Date();
  await cycle.save();
  return cycle;
}

/** Plan-vs-actual for a closed cycle — per line and an overall accuracy summary. */
function getVariance(cycle) {
  if (cycle.status !== 'closed') throw new Error('Variance is only available for a closed cycle.');
  const lines = cycle.lines.map((l) => {
    const varianceQty = (l.actualSoldQty || 0) - l.consensusDemandQty;
    const variancePercent = l.consensusDemandQty > 0 ? Math.round((varianceQty / l.consensusDemandQty) * 10000) / 100 : null;
    return { productId: l.productId, consensusDemandQty: l.consensusDemandQty, actualSoldQty: l.actualSoldQty, varianceQty, variancePercent };
  });
  const totalConsensus = lines.reduce((s, l) => s + l.consensusDemandQty, 0);
  const totalAbsError = lines.reduce((s, l) => s + Math.abs(l.varianceQty), 0);
  const overallAccuracyPercent = totalConsensus > 0 ? Math.round((1 - totalAbsError / totalConsensus) * 10000) / 100 : null;
  return { lines, overallAccuracyPercent };
}

async function getCycle(companyId, cycleId) {
  const cycle = await SopCycle.findOne({ _id: cycleId, companyId });
  if (!cycle) throw new Error('S&OP cycle not found.');
  return cycle;
}

async function listCycles(companyId, { status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return SopCycle.find(filter).sort({ period: -1 });
}

module.exports = { generateCycle, updateLine, submitForReview, decide, closeCycle, getVariance, getCycle, listCycles };
