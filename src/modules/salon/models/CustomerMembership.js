const { Schema, model } = require('mongoose');

// One customer's purchased instance of a MembershipPackage — tracks
// remaining sessions and expiry. Created when the package is sold
// (salonService.sellMembership), decremented on each redemption
// (salonService.billServiceWithCommission with useMembership: true).
const customerMembershipSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  membershipPackageId: { type: Schema.Types.ObjectId, ref: 'MembershipPackage', required: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true }, // the purchase that created this
  totalSessions: { type: Number, required: true }, // snapshotted from the package at purchase time
  remainingSessions: { type: Number, required: true },
  purchasedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  status: { type: String, default: 'active', enum: ['active', 'expired', 'exhausted'] },
}, { timestamps: true });

module.exports = model('CustomerMembership', customerMembershipSchema);
