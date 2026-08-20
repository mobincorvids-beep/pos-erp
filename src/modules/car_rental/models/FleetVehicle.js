const { Schema, model } = require('mongoose');

// One physical vehicle in a fleet of a given class ("Compact", "SUV").
// The genuinely new mechanic vs. Hardware's tool rental: a customer books
// a CLASS, not a specific unit — "any compact car for these 3 days" — and
// the system has to find ANY interchangeable vehicle in that class with
// no overlapping booking, not check one specific item's own calendar.
// This is a pool-availability search across MULTIPLE candidates, not a
// single-resource date-range check like Hotel's one named room.
const fleetVehicleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  vehicleClass: { type: String, required: true }, // "Compact", "SUV", "Luxury"...
  registrationNumber: { type: String, required: true },
  dailyRate: { type: Number, required: true },
  status: { type: String, default: 'available', enum: ['available', 'rented', 'maintenance'] },
}, { timestamps: true });

fleetVehicleSchema.index({ companyId: 1, registrationNumber: 1 }, { unique: true });

module.exports = model('FleetVehicle', fleetVehicleSchema);
