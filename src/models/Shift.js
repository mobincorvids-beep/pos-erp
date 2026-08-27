const { Schema, model } = require('mongoose');

// A named work shift a company runs (e.g. "Morning", "Night") — employees
// are assigned one via Employee.shiftId. daysOfWeek uses JS Date convention
// (0 = Sunday ... 6 = Saturday) so it lines up directly with `date.getDay()`
// wherever a roster/attendance check needs "does this shift run today".
const shiftSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  name: { type: String, required: true },
  startTime: { type: String, required: true }, // "HH:mm"
  endTime: { type: String, required: true },   // "HH:mm"
  daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Shift', shiftSchema);
