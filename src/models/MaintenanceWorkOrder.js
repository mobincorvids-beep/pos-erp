const { Schema, model } = require('mongoose');

const maintenancePartUsedSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  unitCost: { type: Number, required: true }, // internal cost, not a customer price — nothing here is ever billed to a customer
}, { _id: false });

// A real repair/service job against the company's OWN asset — opened
// either from a MaintenancePlan coming due, or ad-hoc (something broke).
// Tracks downtime and real cost so the spec's MTTR/MTBF/downtime-cost
// reporting has real data to compute from, not a placeholder.
const maintenanceWorkOrderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true }, // where parts are drawn from, same as ServiceOrder
  assetId: { type: Schema.Types.ObjectId, ref: 'FixedAsset', required: true },
  planId: { type: Schema.Types.ObjectId, ref: 'MaintenancePlan', default: null }, // set when opened from a due plan; null for ad-hoc/breakdown work
  issue: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  assignedTechnicianId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  status: { type: String, default: 'open', enum: ['open', 'in_progress', 'completed', 'cancelled'] },

  partsUsed: [maintenancePartUsedSchema],
  laborCost: { type: Number, default: 0 },

  downtimeStart: { type: Date, default: null }, // when the asset actually went out of service
  downtimeEnd: { type: Date, default: null }, // when it came back — set on completion

  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null }, // real expense posting once completed
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // who opened it
}, { timestamps: true });

maintenanceWorkOrderSchema.index({ companyId: 1, assetId: 1, status: 1 });

module.exports = model('MaintenanceWorkOrder', maintenanceWorkOrderSchema);
