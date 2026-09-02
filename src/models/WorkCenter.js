const { Schema, model } = require('mongoose');

// A machine / production line / labor group with finite daily capacity.
// Routing operations and the forward scheduler both key off capacityHoursPerDay
// to avoid double-booking a work center past what it can actually run in a day.
const workCenterSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  description: String,
  capacityHoursPerDay: { type: Number, required: true, default: 8 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('WorkCenter', workCenterSchema);
