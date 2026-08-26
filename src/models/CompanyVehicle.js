const { Schema, model } = require('mongoose');

// The standalone CORE vehicle record — any business with company-owned
// vehicles (not just Car Rental's rented-out fleet or Logistics' delivery
// fleet) can register one here. Deliberately generic: no daily rate (not
// rented to anyone), no delivery-route concept — just the asset itself,
// who's driving it, and its condition, with FuelLog/VehicleTrip hanging
// off assignedDriverId/odometerReading the same way MaintenancePlan hangs
// off FixedAsset.
const vehicleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
  registrationNumber: { type: String, required: true },
  make: { type: String, default: '' },
  model: { type: String, default: '' },
  year: { type: Number, default: null },
  type: { type: String, default: 'car', enum: ['car', 'van', 'truck', 'bike', 'bus', 'other'] },
  status: { type: String, default: 'active', enum: ['active', 'maintenance', 'retired'] },
  assignedDriverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  odometerReading: { type: Number, default: 0 },
  fuelType: { type: String, default: 'petrol', enum: ['petrol', 'diesel', 'cng', 'electric', 'hybrid', 'other'] },
  notes: { type: String, default: '' },
}, { timestamps: true });

vehicleSchema.index({ companyId: 1, registrationNumber: 1 }, { unique: true });
vehicleSchema.index({ companyId: 1, status: 1 });

// Registered as 'CompanyVehicle', NOT 'Vehicle' — the service_station
// industry module already registers its own 'Vehicle' mongoose model
// (src/modules/service_station/models/Vehicle.js, a customer-owned
// vehicle being serviced, an unrelated concept from this company-owned
// fleet asset). Two schemas registering the same model name throws
// Mongoose's OverwriteModelError at require-time — confirmed by actually
// requiring src/app.js end-to-end, not just node --check per file.
module.exports = model('CompanyVehicle', vehicleSchema);
