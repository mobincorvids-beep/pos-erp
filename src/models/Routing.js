const { Schema, model } = require('mongoose');

// An ordered list of operations to build one finished unit of a BOM. Linked
// to a BillOfMaterials (not directly to the product) since a product can have
// multiple BOMs over time and each may be routed differently. This is what
// lets a WorkOrder be scheduled against real work-center capacity instead of
// a bare start/complete with no timing.
const operationSchema = new Schema({
  sequence: { type: Number, required: true },
  workCenterId: { type: Schema.Types.ObjectId, ref: 'WorkCenter', required: true },
  operationName: { type: String, required: true },
  estimatedHours: { type: Number, required: true }, // total hours this operation takes to run a work order's FULL quantityToProduce (not per-unit) — kept simple so scheduling doesn't need to guess a per-unit rate
  actualHours: { type: Number, default: null },
}, { _id: true });

const routingSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  bomId: { type: Schema.Types.ObjectId, ref: 'BillOfMaterials', required: true, index: true },
  name: { type: String, required: true },
  operations: [operationSchema],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Routing', routingSchema);
