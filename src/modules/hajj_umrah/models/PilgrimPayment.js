const { Schema, model } = require('mongoose');

const paymentEntrySchema = new Schema({
  amount: { type: Number, required: true },
  paymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  paidAt: { type: Date, default: Date.now },
}, { _id: false });

// One pilgrim's own installment plan toward one group's packagePrice —
// genuinely independent per pilgrim (two people in the same group can be
// at completely different points in their own payment schedule), the
// exact shape Layaway's plan already established, just keyed to a seat in
// a PilgrimageGroup instead of a physical item held in a warehouse.
const pilgrimPaymentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, // denormalized from the group at creation time, so every voucher this plan posts carries real branch context — never has to re-fetch the group just to know which branch a payment belongs to
  groupId: { type: Schema.Types.ObjectId, ref: 'PilgrimageGroup', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  totalPrice: { type: Number, required: true }, // snapshotted from the group's packagePrice at the moment this plan was created — a later price change never retroactively alters an in-progress plan
  amountPaid: { type: Number, default: 0 },
  payments: [paymentEntrySchema],
  depositLiabilityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  status: { type: String, default: 'active', enum: ['active', 'completed', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

pilgrimPaymentSchema.index({ groupId: 1, customerId: 1 }, { unique: true });

module.exports = model('PilgrimPayment', pilgrimPaymentSchema);
