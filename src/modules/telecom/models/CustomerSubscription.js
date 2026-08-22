const { Schema, model } = require('mongoose');

// One customer's active plan and their usage FOR THE CURRENT BILLING
// PERIOD ONLY — usedMinutes/usedDataMB/usedSms all reset to 0 the moment
// a period is billed, exactly the way a real phone bill's "minutes used
// this cycle" resets every month, not a lifetime running total.
const customerSubscriptionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  planId: { type: Schema.Types.ObjectId, ref: 'TelecomPlan', required: true },
  currentPeriodStart: { type: Date, required: true },
  usedMinutes: { type: Number, default: 0 },
  usedDataMB: { type: Number, default: 0 },
  usedSms: { type: Number, default: 0 },
  status: { type: String, default: 'active', enum: ['active', 'suspended', 'cancelled'] },
}, { timestamps: true });

module.exports = model('CustomerSubscription', customerSubscriptionSchema);
