const { Schema, model } = require('mongoose');

const eventBookingSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  venueId: { type: Schema.Types.ObjectId, ref: 'EventVenue', required: true, index: true },
  packageId: { type: Schema.Types.ObjectId, ref: 'EventPackage', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  eventDate: { type: Date, required: true },
  guestCount: { type: Number, required: true },
  pricePerPerson: { type: Number, required: true }, // snapshotted at booking time
  venueRentalFee: { type: Number, required: true },  // snapshotted at booking time
  status: { type: String, default: 'booked', enum: ['booked', 'completed', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  // Same advance-deposit interlink Hotel established: Dr cash, Cr this
  // liability account at booking. What's new here is what happens to it on
  // CANCELLATION — see bookingService.cancelBooking — Hotel never modeled
  // a cancellation-with-partial-forfeiture at all.
  depositAmount: { type: Number, default: 0 },
  depositReceivedInAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  depositLiabilityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('EventBooking', eventBookingSchema);
