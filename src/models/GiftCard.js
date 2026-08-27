const { Schema, model } = require('mongoose');

// A stored-value card sold to a customer and later redeemed as a payment
// method at POS checkout — the same "sell it now, real liability until
// it's spent" shape as a customer deposit. cardNumber is generated
// server-side (see giftCardService.generateCardNumber) and is unique per
// company, not globally, matching how documentNumber/invoiceNumber scope
// their own uniqueness in this codebase.
const giftCardSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  cardNumber: { type: String, required: true },
  initialBalance: { type: Number, required: true },
  currentBalance: { type: Number, required: true },
  issuedToCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
  status: { type: String, default: 'active', enum: ['active', 'redeemed', 'expired', 'cancelled'] },
  expiresAt: { type: Date, default: null },
  issuedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Unique per company (not globally) — same reasoning documentNumber/
// invoiceNumber already established elsewhere in this app.
giftCardSchema.index({ companyId: 1, cardNumber: 1 }, { unique: true });

module.exports = model('GiftCard', giftCardSchema);
