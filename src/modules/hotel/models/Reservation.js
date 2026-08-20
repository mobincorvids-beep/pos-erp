const { Schema, model } = require('mongoose');

const extraChargeSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  description: String, // "Minibar", "Restaurant charge"...
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
}, { _id: false });

const reservationSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  guestName: String, // for a walk-in with no Customer record
  checkInDate: { type: Date, required: true },
  checkOutDate: { type: Date, required: true },
  guests: { type: Number, default: 1 },
  ratePerNight: { type: Number, required: true }, // snapshotted from Room at booking time — a later rate change doesn't retroactively alter an existing reservation
  status: { type: String, default: 'booked', enum: ['booked', 'checked_in', 'checked_out', 'cancelled'] },
  extraCharges: [extraChargeSchema], // added during the stay (minibar, room service...), billed together with room charges at checkout
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // linked once billed at check-out
  // An advance deposit is Dr the account cash/bank actually landed in, Cr a
  // liability account (see hotelService.bookReservation) — recorded as an
  // owed-but-unearned balance, not revenue yet. At check-out, that SAME
  // liability account is passed as a checkout "payment" account for the
  // covered portion — posSaleService's normal voucher logic then debits it
  // (correctly drawing down the liability) and credits revenue (correctly
  // recognizing it as earned), with zero special-cased accounting logic.
  advanceReceivedInAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  depositLiabilityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  advanceAmount: { type: Number, default: 0 },
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // who booked it
}, { timestamps: true });

module.exports = model('Reservation', reservationSchema);
