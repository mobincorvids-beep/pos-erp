const { Schema, model } = require('mongoose');

// Deliberately tied to FixedAsset — this is internal "keep our own
// equipment running" maintenance, not ServiceOrder's "repair a
// customer's item for pay". A generator, a delivery vehicle already on
// the fixed-asset register, a piece of production machinery — anything
// the company itself owns and depreciates is exactly what belongs here.
const maintenancePlanSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  assetId: { type: Schema.Types.ObjectId, ref: 'FixedAsset', required: true },
  name: { type: String, required: true }, // "Quarterly generator service"
  frequencyDays: { type: Number, required: true }, // interval between due dates
  nextDueDate: { type: Date, required: true },
  checklist: { type: [String], default: [] },
  estimatedCost: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

maintenancePlanSchema.index({ companyId: 1, isActive: 1, nextDueDate: 1 });

module.exports = model('MaintenancePlan', maintenancePlanSchema);
