const { Schema, model } = require('mongoose');

// Mirror of PortalUser but scoped to a Supplier instead of a Customer —
// deliberately a separate model (not a login bolted onto Supplier) for
// the same reason PortalUser is separate from Customer: a supplier
// portal login carries none of User's role/permission machinery, and its
// JWT is a different shape entirely (see supplierPortalAuth) so it can
// never be confused with a staff token or a customer-portal token.
const supplierPortalUserSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  invitedAt: { type: Date, default: Date.now },
  activatedAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

supplierPortalUserSchema.index({ companyId: 1, email: 1 }, { unique: true });

module.exports = model('SupplierPortalUser', supplierPortalUserSchema);
