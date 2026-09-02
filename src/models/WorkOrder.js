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
  startedAt: Date,
  completedAt: Date,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  mrpRunId: { type: Schema.Types.ObjectId, ref: 'MrpRun', default: null }, // set when created from an MRP run's suggested-work-order line
}, { timestamps: true });

module.exports = model('WorkOrder', workOrderSchema);
