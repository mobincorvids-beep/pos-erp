const { Schema, model } = require('mongoose');

// One bookable occurrence of a GymClass. The genuinely new mechanic this
// module exists for: MANY customers share ONE resource up to a fixed
// capacity — every prior booking-shaped module (Hotel's room, Banquet's
// venue, Hospital's single-file queue) is exclusive, one booking blocks
// the whole resource. A class doesn't work that way: 20 people can be
// enrolled in the same 6pm session simultaneously, and the 21st goes to a
// waitlist that auto-promotes when a seat opens up — see gymService.
const classSessionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  gymClassId: { type: Schema.Types.ObjectId, ref: 'GymClass', required: true, index: true },
  startTime: { type: Date, required: true },
  capacity: { type: Number, required: true }, // snapshotted from GymClass at session-creation time — a later capacity change on the class doesn't retroactively alter an already-scheduled session
  enrolledCustomerIds: [{ type: Schema.Types.ObjectId, ref: 'Customer' }],
  // Ordered array = waitlist position — index 0 is next in line. A plain
  // array (not a separate collection with a position field) because the
  // whole point of a waitlist is its ORDER, and array order IS that order.
  waitlistCustomerIds: [{ type: Schema.Types.ObjectId, ref: 'Customer' }],
  status: { type: String, default: 'scheduled', enum: ['scheduled', 'completed', 'cancelled'] },
}, { timestamps: true });

module.exports = model('ClassSession', classSessionSchema);
