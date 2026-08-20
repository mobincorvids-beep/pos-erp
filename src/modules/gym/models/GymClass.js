const { Schema, model } = require('mongoose');

// A recurring class TYPE (e.g. "Morning Yoga") — the template. Actual
// bookable occurrences are ClassSession, one per scheduled time slot,
// since capacity/enrollment is inherently per-occurrence, not per-class.
const gymClassSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  name: { type: String, required: true },
  instructorEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null }, // an instructor is staff — reuse core HR, same reasoning as Hospital's doctor link
  capacity: { type: Number, required: true },
  durationMinutes: { type: Number, default: 60 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('GymClass', gymClassSchema);
