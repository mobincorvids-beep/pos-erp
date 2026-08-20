const { Schema, model } = require('mongoose');

// A physical room — deliberately its own resource type, not a core
// "Product" or reused Appointment staff slot. A room's availability is a
// date-range overlap (nights), not a time-of-day overlap like a stylist's
// calendar, and it has its own housekeeping state machine a person doesn't.
const roomSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  roomNumber: { type: String, required: true },
  roomType: String, // "Single", "Deluxe", "Suite"...
  ratePerNight: { type: Number, required: true },
  // The sellable line-item a night in this room bills as at checkout — same
  // "module overlays a core Product" convention as SalonService/MembershipPackage.
  billingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  billingVariantId: { type: Schema.Types.ObjectId, required: true },
  // available -> occupied (on check-in) -> cleaning (on check-out, needs
  // housekeeping) -> available again (explicit markClean call, not
  // automatic — a real hotel doesn't want a room resold before it's
  // actually been cleaned just because checkout happened).
  status: { type: String, default: 'available', enum: ['available', 'occupied', 'cleaning', 'maintenance'] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

roomSchema.index({ companyId: 1, branchId: 1, roomNumber: 1 }, { unique: true });

module.exports = model('Room', roomSchema);
