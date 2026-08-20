const { Schema, model } = require('mongoose');

const rentalBookingSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  vehicleClass: { type: String, required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'FleetVehicle', default: null }, // assigned at booking time from whichever unit in the class is actually free
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  dailyRate: { type: Number, required: true },
  depositAmount: { type: Number, default: 0 },
  depositReceivedInAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  depositLiabilityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  rentalBillingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  rentalBillingVariantId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, default: 'booked', enum: ['booked', 'returned', 'cancelled'] },
  actualReturnDate: Date,
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

module.exports = model('RentalBooking', rentalBookingSchema);
