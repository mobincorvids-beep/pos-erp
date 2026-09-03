const { Schema, model } = require('mongoose');

// A single operation's scheduled slot, computed by the forward scheduler when
// the work order is started against a routing. Persisted on the work order
// itself (rather than a separate collection) so scheduling other work orders
// against the same work center can simply query WorkOrder for existing slots.
const scheduledOperationSchema = new Schema({
  routingOperationId: { type: Schema.Types.ObjectId }, // matches Routing.operations[i]._id
  sequence: { type: Number, required: true },
  workCenterId: { type: Schema.Types.ObjectId, ref: 'WorkCenter', required: true },
  operationName: { type: String, required: true },
  estimatedHours: { type: Number, required: true },
  actualHours: { type: Number, default: null },
  scheduledStart: { type: Date, required: true },
  scheduledEnd: { type: Date, required: true },
  status: { type: String, default: 'scheduled', enum: ['scheduled', 'in_progress', 'completed'] },
}, { _id: true });

// One raw-material batch/lot actually consumed against a work order, for
// traceability ("this batch of finished fabric used cotton yarn batches X
// and Y"). Populated by startProduction() when a consumed component's
// product is batch/expiry tracked (Product.trackExpiry or trackingMode
// 'batch') — FEFO-picked the same way POS checkout picks batches. Plain
// (non-batch-tracked) components consume without an entry here, same as
// before.
const consumedBatchSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', required: true },
  batchNumber: { type: String }, // denormalized for display without a populate
  quantityConsumed: { type: Number, required: true },
}, { _id: false });

// A production run against a BOM. Two-phase (start -> complete) rather than
// one atomic call, mirroring StockTransfer's initiate/receive pattern —
// production has a real duration (hours/days) between raw materials being
// consumed and finished goods coming out.
const workOrderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  bomId: { type: Schema.Types.ObjectId, ref: 'BillOfMaterials', required: true },
  routingId: { type: Schema.Types.ObjectId, ref: 'Routing', default: null }, // optional — only work orders routed to work centers get scheduled
  workOrderNumber: { type: String, required: true, unique: true },
  quantityToProduce: { type: Number, required: true },
  quantityProduced: { type: Number, default: 0 },
  scrapQuantity: { type: Number, default: 0 }, // rejected/scrapped units, feeds the efficiency/OEE-adjacent report
  status: { type: String, default: 'planned', enum: ['planned', 'in_progress', 'completed', 'cancelled'] },
  actualLaborCost: Number,   // overrides bom.laborCostPerUnit * quantity if the actual run cost differently
  actualOverheadCost: Number,
  wastageNote: String,
  schedule: [scheduledOperationSchema], // populated by the forward scheduler when the work order is started
  consumedBatches: [consumedBatchSchema], // raw material batch/lot traceability, populated at startProduction()

  // Backflush / actual-consumption reporting. startProduction() always
  // consumes the full planned BOM quantity (component.quantityPerUnit x
  // quantityToProduce) up front — actualConsumption records what
  // completeProduction() was told was REALLY used per component, so the
  // delta (actual - planned) can be posted as a stock adjustment and this
  // stays available for reporting even though the ledger itself only ever
  // shows the two movements (planned consume at start, delta adjustment at
  // completion).
  actualConsumption: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: Schema.Types.ObjectId },
    plannedQuantity: { type: Number },
    actualQuantity: { type: Number },
    _id: false,
  }],

  // --- Production costing (posted on completeProduction) ---
  actualMaterialCost: { type: Number, default: null }, // sum of (actual consumption x cost at consumption) across all components
  overheadCost: { type: Number, default: null },        // manual overhead allocation for this run (mirrors actualOverheadCost, kept as the spec-named field)
  totalProductionCost: { type: Number, default: null },  // actualMaterialCost + actualLaborCost + overheadCost
  costPerUnit: { type: Number, default: null },           // totalProductionCost / quantityProduced

  // --- Yield / wastage ---
  expectedOutputQuantity: { type: Number, default: null }, // set at creation = quantityToProduce (1:1 BOM ratio in this data model)
  actualOutputQuantity: { type: Number, default: null },    // set at completion = quantityProduced
  yieldPercentage: { type: Number, default: null },         // actualOutputQuantity / expectedOutputQuantity * 100
  wastageQuantity: { type: Number, default: null },         // max(expectedOutputQuantity - actualOutputQuantity, 0)

  startedAt: Date,
  completedAt: Date,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  mrpRunId: { type: Schema.Types.ObjectId, ref: 'MrpRun', default: null }, // set when created from an MRP run's suggested-work-order line
}, { timestamps: true });

module.exports = model('WorkOrder', workOrderSchema);
