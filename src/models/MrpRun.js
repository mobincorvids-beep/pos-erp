const { Schema, model } = require('mongoose');

// A snapshot of one MRP explosion so a vendor/planner can review the computed
// shortage list before acting on it — inputs (the demand that triggered the
// run) and outputs (suggested purchases / work orders, with running convert
// state) are both stored, not recomputed on read.

const demandLineSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  source: { type: String, enum: ['manual', 'reorder_level'], default: 'manual' },
  // Optional date this demand is actually needed by (e.g. a sales order's
  // promised date). Purely additive — omitted entirely, runMrp() behaves
  // exactly as before and no plannedOrderDate is computed downstream.
  needByDate: { type: Date, default: null },
}, { _id: false });

const suggestedPurchaseLineSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  requiredQuantity: { type: Number, required: true }, // total gross requirement from the explosion
  onHandQuantity: { type: Number, required: true },
  shortfallQuantity: { type: Number, required: true }, // requiredQuantity - onHandQuantity, netted (also floored at the component's safetyStockQty — see mrpService)
  estimatedUnitCost: { type: Number, default: 0 },
  status: { type: String, enum: ['suggested', 'converted', 'dismissed'], default: 'suggested' },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  // Lead-time awareness (see mrpService.runMrp): needByDate is the earliest
  // date this shortfall was actually required by (from whichever demand
  // line(s) generated it, when supplied); leadTimeDays is the preferred
  // supplier's Supplier.leadTimeDays at the time of this run; plannedOrderDate
  // = needByDate - leadTimeDays, i.e. the release date this PO should
  // actually be placed by to land on time. All three are null when
  // needByDate wasn't supplied or no preferred supplier/lead time is known
  // — this run then behaves exactly as it did before this field existed.
  needByDate: { type: Date, default: null },
  leadTimeDays: { type: Number, default: null },
  plannedOrderDate: { type: Date, default: null },
}, { _id: true });

const suggestedWorkOrderLineSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  bomId: { type: Schema.Types.ObjectId, ref: 'BillOfMaterials', required: true },
  requiredQuantity: { type: Number, required: true },
  status: { type: String, enum: ['suggested', 'converted', 'dismissed'], default: 'suggested' },
  workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
}, { _id: true });

const mrpRunSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  demand: [demandLineSchema], // the inputs — manually entered target quantities and/or auto-pulled reorder-level shortfalls
  suggestedPurchases: [suggestedPurchaseLineSchema],
  suggestedWorkOrders: [suggestedWorkOrderLineSchema],
  status: { type: String, enum: ['computed', 'reviewed'], default: 'computed' },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('MrpRun', mrpRunSchema);
