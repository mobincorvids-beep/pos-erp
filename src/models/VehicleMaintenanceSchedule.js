const { Schema, model } = require('mongoose');

/**
 * A recurring service schedule for a fleet vehicle (CompanyVehicle) —
 * "every 5,000km or 90 days, whichever comes first" being the typical
 * case, so both an odometer-based and a time-based interval are tracked
 * and either one alone can trigger the next due date/mileage. This is the
 * fleet equivalent of MaintenancePlan (which is scoped to FixedAsset, not
 * vehicles specifically) — kept separate rather than shoehorning vehicles
 * into FixedAsset, since a vehicle may not be on the fixed-asset register
 * at all (e.g. a leased/rented vehicle) and mileage-based due dates have
 * no FixedAsset/MaintenancePlan equivalent to reuse.
 */
const vehicleMaintenanceScheduleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'CompanyVehicle', required: true, index: true },
  name: { type: String, required: true }, // "Oil change", "Major service"

  intervalKm: { type: Number, default: null }, // null = not mileage-triggered
  intervalDays: { type: Number, default: null }, // null = not time-triggered

  lastServiceOdometer: { type: Number, default: null },
  lastServiceDate: { type: Date, default: null },

  nextDueOdometer: { type: Number, default: null },
  nextDueDate: { type: Date, default: null },

  checklist: { type: [String], default: [] },
  estimatedCost: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  dueNotified: { type: Boolean, default: false }, // mirrors the Document/Driver expiry-notified pattern — reset to false each time the schedule advances
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

vehicleMaintenanceScheduleSchema.index({ companyId: 1, isActive: 1, nextDueDate: 1 });
vehicleMaintenanceScheduleSchema.index({ companyId: 1, vehicleId: 1 });

module.exports = model('VehicleMaintenanceSchedule', vehicleMaintenanceScheduleSchema);
