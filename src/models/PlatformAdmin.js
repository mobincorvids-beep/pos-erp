const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

// Deliberately a separate collection from User, not a "companyId: null" User —
// a platform admin isn't a member of any tenant, has a completely different
// permission surface (cross-company), and mixing the two would mean every
// tenant-scoped query needs an extra guard against accidentally matching one.
const platformAdminSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'admin', enum: ['admin', 'support'] }, // support: read-mostly, no destructive actions
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

platformAdminSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

platformAdminSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = model('PlatformAdmin', platformAdminSchema);
