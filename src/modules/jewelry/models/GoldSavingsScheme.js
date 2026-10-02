const { Schema, model } = require('mongoose');

// A fixture of the jewelry trade in South Asia: a customer commits to a
// fixed monthly payment for a set number of months, then redeems the
// accumulated total toward a purchase — the shop's incentive to offer it
// is locking in a future sale; the customer's is a disciplined way to
// save specifically earmarked for gold. The cash is real and received
// monthly (unlike BuybackTransaction's credit, which is only ever a
// quoted estimate until a sale happens) — so each installment is a real
// liability on the books from the moment it's received, cleared only when
// redeemed against an actual sale. Same "liability account holds it,
// checkout clears it" shape Hotel/Banquet/Travel already established for
// deposits — the genuinely new part here is many small installments
// accumulating over months rather than one deposit at booking time.
const installmentSchema = new Schema({
  amount: { type: Number, required: true },
  paidAt: { type: Date, default: Date.now },
  receivedInAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
}, { _id: false });

const goldSavingsSchemeSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },

  targetKarat: { type: Number, required: true }, // which karat's rate values the final redemption
  monthlyAmount: { type: Number, required: true },
  totalMonths: { type: Number, required: true },
  startDate: { type: Date, required: true },

  // The liability account every installment (and the final redemption
  // clearing) posts against — fixed at enrollment so every installment
  // for this scheme lands in the same place, the same way a single
  // Hotel/Banquet booking fixes its deposit's liability account once.
  liabilityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },

  installments: [installmentSchema],
  totalPaid: { type: Number, default: 0 },

  status: { type: String, default: 'active', enum: ['active', 'matured', 'redeemed', 'cancelled'] },

  redeemedAt: { type: Date, default: null },
  redeemedSaleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  redeemedWeightGrams: { type: Number, default: null }, // totalPaid / rate-at-redemption, for the customer's record

  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // who enrolled the customer
}, { timestamps: true });

module.exports = model('GoldSavingsScheme', goldSavingsSchemeSchema);
