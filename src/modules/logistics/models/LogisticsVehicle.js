const { Schema, model } = require('mongoose');

// The company's OWN vehicle used for its own delivery trips — genuinely
// different from Car Rental's FleetVehicle (rented OUT to customers, billed
// per day) and from Courier's Shipment (tracks one PACKAGE's journey, no
// cost/profitability concept at all). This module exists for internal
// cost efficiency: what did it actually cost to run this vehicle today,
// against what the deliveries it carried actually earned.
const logisticsVehicleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  registrationNumber: { type: String, required: true },
  vehicleType: String, // "Van", "Truck", "Motorbike"
}, { timestamps: true });

module.exports = model('LogisticsVehicle', logisticsVehicleSchema);
