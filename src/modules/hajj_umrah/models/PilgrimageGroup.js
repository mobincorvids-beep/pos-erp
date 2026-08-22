const { Schema, model } = require('mongoose');

// A departure — a fixed-capacity group (a real quota, the exact shape
// Gym's ClassSession already established: enrolled fills up to capacity,
// anyone past that waits in line, and a cancellation promotes the
// longest-waiting person automatically). What's genuinely new here is
// combining that with Retail's Layaway pattern PER PILGRIM — each seat
// isn't paid for in one shot, it's paid off via an open-ended series of
// installments toward the package price, and the two mechanics have never
// had to interact in this app before: a waitlisted pilgrim who gets
// promoted into an open seat needs their OWN independent payment plan
// starting fresh, not inheriting whatever the person who cancelled had paid.
const pilgrimageGroupSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  packageName: { type: String, required: true }, // "Umrah - Ramadan Group A"
  departureDate: { type: Date, required: true },
  capacity: { type: Number, required: true },
  packagePrice: { type: Number, required: true },
  enrolledCustomerIds: [{ type: Schema.Types.ObjectId, ref: 'Customer' }],
  waitlistCustomerIds: [{ type: Schema.Types.ObjectId, ref: 'Customer' }],
  status: { type: String, default: 'open', enum: ['open', 'departed', 'cancelled'] },
}, { timestamps: true });

module.exports = model('PilgrimageGroup', pilgrimageGroupSchema);
