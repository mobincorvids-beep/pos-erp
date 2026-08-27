const { Schema, model } = require('mongoose');

// Mirrors PortalUser.js but scoped to one Employee record instead of one
// Customer — deliberately a SEPARATE model/login from both PortalUser and
// User, so an employee-portal JWT can never be replayed against the
// customer portal or the staff app (see employeePortalAuth.js).
const employeePortalUserSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  invitedAt: { type: Date, default: Date.now },
  activatedAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

employeePortalUserSchema.index({ companyId: 1, email: 1 }, { unique: true });

module.exports = model('EmployeePortalUser', employeePortalUserSchema);
