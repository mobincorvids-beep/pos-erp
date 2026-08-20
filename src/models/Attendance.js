const { Schema, model } = require('mongoose');

const attendanceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  date: { type: Date, required: true },
  status: { type: String, required: true, enum: ['present', 'absent', 'leave', 'holiday'] },
  checkIn: Date,
  checkOut: Date,
  note: String,
}, { timestamps: true });

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = model('Attendance', attendanceSchema);
