const { Schema, model } = require('mongoose');

const paymentSchema = new Schema({
  amount: { type: Number, required: true },
  paymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  paidAt: { type: Date, default: Date.now },
}, { _id: false });

// A layaway hold — genuinely different from every prior deposit-based
// module (Hotel, Banquet, Furniture all take ONE deposit, then bill the
// remainder in a single later action). This is an open-ended SERIES of
// partial payments accumulating toward a target with no fixed schedule,
// and completion isn't triggered by a date or an explicit "finish" call —
// it's triggered automatically the moment amountPaid crosses totalPrice,
// by whichever payment happens to tip it over. The item is held out of
// sellable stock (reserved, not deducted) for the entire open period.
const layawayPlanSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, default: 1 },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  totalPrice: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  payments: [paymentSchema],
  depositLiabilityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true }, // every payment is Dr Cash / Cr this — none of it is revenue until the plan actually completes
  status: { type: String, default: 'active', enum: ['active', 'completed', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

module.exports = model('LayawayPlan', layawayPlanSchema);
