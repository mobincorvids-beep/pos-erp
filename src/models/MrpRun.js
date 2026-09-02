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
}, { _id: false });

const suggestedPurchaseLineSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  requiredQuantity: { type: Number, required: true }, // total gross requirement from the explosion
  onHandQuantity: { type: Number, required: true },
  shortfallQuantity: { type: Number, required: true }, // requiredQuantity - onHandQuantity, netted
  estimatedUnitCost: { type: Number, default: 0 },
  status: { type: String, enum: ['suggested', 'converted', 'dismissed'], default: 'suggested' },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
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
