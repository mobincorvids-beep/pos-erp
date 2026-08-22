const { Schema, model } = require('mongoose');

// One tenancy on one property — potentially running for months or years,
// with rent generated period by period rather than billed once up front.
// lastRentGeneratedThrough tracks exactly how far billing has progressed,
// the same "the meter advances one real period at a time" principle
// School's batch fee invoicing and Telecom's monthly billing period both
// already established, just at a longer, tenancy-length timescale.
const leaseSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  tenantCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  monthlyRent: { type: Number, required: true },
  lateFeePerDay: { type: Number, default: 0 },
  securityDeposit: { type: Number, default: 0 },
  securityDepositLiabilityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  lastRentGeneratedThrough: { type: Date, required: true }, // the due date of the most recently BILLED period — the next bill's due date is exactly one month after this
  status: { type: String, default: 'active', enum: ['active', 'ended'] },
}, { timestamps: true });

module.exports = model('Lease', leaseSchema);
