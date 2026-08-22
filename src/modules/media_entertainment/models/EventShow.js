const { Schema, model } = require('mongoose');

const tierSchema = new Schema({
  name: { type: String, required: true }, // "VIP", "Standard", "Balcony"...
  capacity: { type: Number, required: true },
  price: { type: Number, required: true },
  soldCustomerIds: [{ type: Schema.Types.ObjectId, ref: 'Customer' }],
  waitlistCustomerIds: [{ type: Schema.Types.ObjectId, ref: 'Customer' }],
}, { _id: true });

// One showtime — the genuinely new mechanic vs. Gym's ClassSession: this
// isn't ONE flat capacity, it's several INDEPENDENT capacity pools living
// inside the same event. A sold-out VIP tier and a half-empty Standard
// tier coexist on the exact same show at the exact same time — someone
// waitlisted for VIP is NOT automatically offered a Standard seat, and
// vice versa, because they're genuinely different products at genuinely
// different prices, not interchangeable units of "a seat." Each tier
// therefore carries its OWN soldCustomerIds and its OWN waitlistCustomerIds.
const eventShowSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  eventName: { type: String, required: true }, // "Coke Studio Live"
  showDateTime: { type: Date, required: true },
  tiers: { type: [tierSchema], required: true },
  status: { type: String, default: 'scheduled', enum: ['scheduled', 'completed', 'cancelled'] },
}, { timestamps: true });

module.exports = model('EventShow', eventShowSchema);
