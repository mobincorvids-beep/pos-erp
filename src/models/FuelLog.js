const { Schema, model } = require('mongoose');

// One real refueling event against a Vehicle. Posts a real expense
// voucher the same way MaintenanceWorkOrder does — nothing here is ever
// billed to a customer, it's an internal running cost.
const fuelLogSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'CompanyVehicle', required: true },
  date: { type: Date, default: Date.now },
  odometerReading: { type: Number, required: true },
  quantity: { type: Number, required: true }, // liters/gallons/kg per fuelType
  cost: { type: Number, required: true },
  paymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null }, // real expense posting
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

fuelLogSchema.index({ companyId: 1, vehicleId: 1, date: -1 });

module.exports = model('FuelLog', fuelLogSchema);
