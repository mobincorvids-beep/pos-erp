const { Schema, model } = require('mongoose');

// A customer-owned asset with usage-based service triggers — the
// genuinely new mechanic this module exists for. Every prior industry
// module's "next due" trigger has been calendar time (Hotel's check-out
// date, School's billing period, Banquet's event date); this one is
// USAGE (mileage), reported by a technician/customer, not something the
// system can compute on its own like a date can. nextServiceDueMileage/
// nextServiceDueDate are both stored (not computed on read) specifically
// so listServiceDue() can be a real indexed Mongo query, not a full
// collection scan re-evaluated in JS on every request.
const vehicleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  make: String,
  model: String,
  year: Number,
  registrationNumber: { type: String, required: true },
  currentMileage: { type: Number, default: 0 },
  serviceIntervalMileage: { type: Number, default: 5000 }, // e.g. service every 5,000 km/mi
  serviceIntervalMonths: { type: Number, default: 6 },
  lastServiceMileage: { type: Number, default: 0 },
  lastServiceDate: { type: Date, default: null },
  nextServiceDueMileage: { type: Number, default: null },
  nextServiceDueDate: { type: Date, default: null },
}, { timestamps: true });

vehicleSchema.index({ companyId: 1, registrationNumber: 1 }, { unique: true });

module.exports = model('Vehicle', vehicleSchema);
