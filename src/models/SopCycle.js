const { Schema, model } = require('mongoose');

/**
 * SopCycle — a monthly Sales & Operations Planning cycle. One document per
 * (companyId, period), where period is a plain 'YYYY-MM' string so cycles
 * sort and dedupe naturally. Reconciles statistical demand (from
 * demandForecastService, already built) against supply capacity (open PO
 * quantities + available production capacity from the existing MRP), rolls
 * both up per product into a consensus plan, and tracks plan-vs-actual once
 * the period closes. Goes through the same generic ApprovalRequest engine
 * every other approval flow in this app uses (entityType 'SopCycle') —
 * nothing new invented for sign-off.
 */
const sopLineSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  // What forecastDemand() actually computed for this period, snapshotted —
  // never a live re-query, so a plan someone approved doesn't silently
  // reshuffle if the forecast is re-run later with more history.
  statisticalForecastQty: { type: Number, default: 0 },
  // Open supply already committed: sum of (quantityOrdered - quantityReceived)
  // across this product's open POs at generation time, plus any in-progress
  // manufacturing output still pending.
  openSupplyQty: { type: Number, default: 0 },
  // The human-editable "what we actually plan to sell/produce" number —
  // defaults to statisticalForecastQty but demand/supply planners can
  // override it during review; this is what downstream MRP/procurement
  // consensus reads, never the raw statistical number directly.
  consensusDemandQty: { type: Number, default: 0 },
  // Supply-side consensus: how much the company plans to have available
  // (produce + procure) to meet consensusDemandQty. Left to the supply
  // planner to fill in; a gap between the two is the whole point of the
  // reconciliation meeting this cycle represents.
  consensusSupplyQty: { type: Number, default: 0 },
  gapQty: { type: Number, default: 0 }, // consensusDemandQty - consensusSupplyQty, recomputed on every save
  note: String,
  // Filled in once the period has actually elapsed — actualSoldQty lets
  // getVariance() score how good this cycle's consensus number turned out
  // to be, closing the planning loop instead of leaving forecasts
  // unaccountable.
  actualSoldQty: { type: Number, default: null },
}, { _id: false });

const sopCycleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  period: { type: String, required: true }, // 'YYYY-MM'
  status: {
    type: String,
    // draft: just generated from the statistical forecast, nobody's
    // touched it yet. under_review: sent through approvalService.request()
    // for demand/supply sign-off. approved / rejected: decided.
    // closed: period has elapsed and actuals have been recorded.
    enum: ['draft', 'under_review', 'approved', 'rejected', 'closed'],
    default: 'draft',
  },
  lines: [sopLineSchema],
  approvalRequestId: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest', default: null },
  generatedAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

sopCycleSchema.index({ companyId: 1, period: 1 }, { unique: true });

module.exports = model('SopCycle', sopCycleSchema);
