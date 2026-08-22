const { Schema, model } = require('mongoose');

// A time-slot booking — the genuinely different granularity from Car
// Rental's day-range overlap check: a court is booked in HOURS, not days,
// and the same facility can have several bookings in one day as long as
// their hour ranges never overlap. startTime/endTime are real Date
// values (not just an hour number), so this naturally handles bookings
// that don't start on the hour and correctly spans midnight if ever needed.
const facilityBookingSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  facilityId: { type: Schema.Types.ObjectId, ref: 'SportsFacility', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, default: 'booked', enum: ['booked', 'completed', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

module.exports = model('FacilityBooking', facilityBookingSchema);
