const { Schema, model } = require('mongoose');

// Deliberately a separate collection from the core Attendance model (which
// tracks Employees) — a student isn't an employee, and mixing the two
// would mean either model carrying fields that make no sense for the
// other. Same upsert-by-day shape as hrService.markAttendance, though,
// since "one status per entity per day" is the same underlying pattern.
const studentAttendanceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  date: { type: Date, required: true },
  status: { type: String, required: true, enum: ['present', 'absent', 'leave'] },
  note: String,
}, { timestamps: true });

studentAttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = model('StudentAttendance', studentAttendanceSchema);
