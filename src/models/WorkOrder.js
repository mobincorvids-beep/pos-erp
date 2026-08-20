const { Schema, model } = require('mongoose');

// A production run against a BOM. Two-phase (start -> complete) rather than
// one atomic call, mirroring StockTransfer's initiate/receive pattern —
// production has a real duration (hours/days) between raw materials being
// consumed and finished goods coming out.
const workOrderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  bomId: { type: Schema.Types.ObjectId, ref: 'BillOfMaterials', required: true },
  workOrderNumber: { type: String, required: true, unique: true },
  quantityToProduce: { type: Number, required: true },
  quantityProduced: { type: Number, default: 0 },
  status: { type: String, default: 'planned', enum: ['planned', 'in_progress', 'completed', 'cancelled'] },
  actualLaborCost: Number,   // overrides bom.laborCostPerUnit * quantity if the actual run cost differently
  actualOverheadCost: Number,
  wastageNote: String,
  startedAt: Date,
  completedAt: Date,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('WorkOrder', workOrderSchema);
