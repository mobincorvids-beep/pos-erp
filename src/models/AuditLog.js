const { Schema, model } = require('mongoose');

// Immutable trail of sensitive actions. Not an auto-instrumented mongoose
// plugin on every model (that would log noise without request context like
// "who" and "why") — instead services explicitly call auditService.record()
// at the point they already know who did what and to which document.
const auditLogSchema = new Schema({
  // Optional, not required — most audit entries are tenant-scoped, but a
  // platform-admin-only action (creating another admin, resetting an
  // admin's password) has no associated company at all. Queries that
  // filter by companyId already treat it as optional (see
  // adminAuditController), so this doesn't change any existing behavior
  // for tenant-scoped entries.
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },     // 'expense.approved', 'purchase_order.created', ...
  entityType: { type: String, required: true }, // 'Expense', 'PurchaseOrder', 'Sale', ...
  entityId: { type: Schema.Types.ObjectId, required: true },
  metadata: { type: Schema.Types.Mixed },        // whatever's useful for that action (amount, before/after, etc.)
  ipAddress: String,
}, { timestamps: true });

auditLogSchema.index({ companyId: 1, entityType: 1, entityId: 1 });
auditLogSchema.index({ companyId: 1, createdAt: -1 });

module.exports = model('AuditLog', auditLogSchema);
