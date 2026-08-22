const { Schema, model } = require('mongoose');

// One season's planting-to-harvest cycle on one field. Deliberately links
// to a REAL core WorkOrder (workOrderId) rather than duplicating
// Manufacturing's own cost-per-unit-of-actual-output logic, which already
// does exactly the right thing (completeProduction divides total real
// cost by actual quantityProduced, correctly reflecting that a poor
// harvest raises the true cost per unit for the same spend) — this
// module's whole job is field-level context (which field, which crop,
// how this compares to the field's own history), not reinventing costing.
const cropCycleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  fieldId: { type: Schema.Types.ObjectId, ref: 'FarmField', required: true, index: true },
  workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
  cropName: { type: String, required: true },
  plantedDate: { type: Date, required: true },
  expectedYield: { type: Number, required: true },
  actualYield: { type: Number, default: null },
  yieldVariance: { type: Number, default: null }, // actualYield - expectedYield, only set once harvested
  status: { type: String, default: 'growing', enum: ['growing', 'harvested', 'failed'] },
}, { timestamps: true });

module.exports = model('CropCycle', cropCycleSchema);
