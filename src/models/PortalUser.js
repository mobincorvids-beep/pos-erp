const { Schema, model } = require('mongoose');

// Deliberately a SEPARATE model from User, not a login bolted onto
// Customer — a portal login is scoped to exactly one customer record and
// carries none of User's role/permission machinery, so there's no
// possibility of a portal account ever being granted internal-staff
// permissions by accident (a portal JWT is a different shape entirely —
// see portalAuthMiddleware — and is rejected outright by requireAuth,
// the staff auth guard, and vice versa).
const portalUserSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

portalUserSchema.index({ companyId: 1, email: 1 }, { unique: true });

module.exports = model('PortalUser', portalUserSchema);
