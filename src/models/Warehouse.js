const { Schema, model } = require('mongoose');

const warehouseSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  name: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  // Foundational DC/branch hierarchy plumbing — no push/pull DRP logic on
  // top yet, just the schema + a basic read (warehouseService.getHierarchy).
  // Defaults to 'standalone' so every existing warehouse (which has no
  // notion of DC vs branch today) keeps behaving exactly as before.
  warehouseType: {
    type: String,
    enum: ['distribution_center', 'branch', 'standalone'],
    default: 'standalone',
  },
  // The DC (or other warehouse) this one is normally replenished from.
  // Null for a DC or a standalone warehouse with no upstream supplier
  // warehouse of its own.
  parentWarehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
}, { timestamps: true });

module.exports = model('Warehouse', warehouseSchema);
