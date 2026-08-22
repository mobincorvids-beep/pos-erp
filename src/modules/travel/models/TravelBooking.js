const { Schema, model } = require('mongoose');

// A trip package booking — deliberately the SAME deposit-then-bill-
// remainder shape Hotel's Reservation already established (book with an
// advance, bill the rest at completion). No new mechanic here — Travel
// genuinely doesn't need one; the honest thing to do with a direct reuse
// is reuse it exactly, not invent artificial novelty for its own sake.
const travelBookingSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  packageName: { type: String, required: true }, // "5-Day Istanbul Tour"
  destination: String,
  travelDate: { type: Date, required: true },
  price: { type: Number, required: true },
  depositAmount: { type: Number, default: 0 },
  depositReceivedInAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  depositLiabilityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  billingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  billingVariantId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, default: 'booked', enum: ['booked', 'completed', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

module.exports = model('TravelBooking', travelBookingSchema);
