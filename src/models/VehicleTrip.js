const { Schema, model } = require('mongoose');

// One real trip a company vehicle made — used to track utilization and
// distance, distinct from Logistics' delivery-route/shipment concept
// (this has no cargo/customer billing attached at all, just the vehicle's
// own movement).
const vehicleTripSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'CompanyVehicle', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // The real driver PROFILE (license/document tracking — see
  // src/models/Driver.js), additive alongside driverId above (kept as-is,
  // ref 'User'). Optional/nullable, same rationale as CompanyVehicle.driverProfileId.
  driverProfileId: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
  purpose: { type: String, default: '' },
  destination: { type: String, default: '' },
  startOdometer: { type: Number, required: true },
  endOdometer: { type: Number, default: null },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, default: null },
  status: { type: String, default: 'scheduled', enum: ['scheduled', 'in_progress', 'completed', 'cancelled'] },
  notes: { type: String, default: '' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // who logged it
}, { timestamps: true });

vehicleTripSchema.index({ companyId: 1, vehicleId: 1, status: 1 });

module.exports = model('VehicleTrip', vehicleTripSchema);
