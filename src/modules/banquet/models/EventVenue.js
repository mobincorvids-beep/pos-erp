const { Schema, model } = require('mongoose');

// A bookable hall — deliberately its own resource type, not a Room (Hotel)
// or a staff calendar (Appointments). A venue's availability is a
// single-day exclusivity check (one event per venue per day), a simpler
// shape than Hotel's multi-night date-range overlap or Appointments'
// time-of-day overlap — a third distinct availability check across the
// eight modules built so far, not a copy of either prior one.
const eventVenueSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  name: { type: String, required: true },
  capacity: { type: Number, required: true },
  baseRentalFee: { type: Number, default: 0 }, // flat fee for the venue itself, on top of per-person package pricing
  rentalBillingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // trackingMode 'service'
  rentalBillingVariantId: { type: Schema.Types.ObjectId, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('EventVenue', eventVenueSchema);
