const { Schema, model } = require('mongoose');

// A customer bringing in old gold for credit toward a new purchase — value
// is computed at intake time (snapshotting the rate, since it's about to be
// weighed and priced right then) and applied as a discount at checkout, the
// same "quote a value, apply it manually as a discount" pattern
// loyaltyService already established (Sale has no header-level discount
// field, only per-line, so neither loyalty points nor a buyback credit get
// a special payment method — both become a discount on the line items).
const buybackTransactionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  karat: { type: Number, required: true },
  weightGrams: { type: Number, required: true },
  deductionPercent: { type: Number, default: 0 }, // for purity/wear/testing loss
  ratePerGram: { type: Number, required: true }, // snapshotted at intake
  creditAmount: { type: Number, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'applied', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('BuybackTransaction', buybackTransactionSchema);
