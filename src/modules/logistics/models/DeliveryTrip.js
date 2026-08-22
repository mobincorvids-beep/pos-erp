const { Schema, model } = require('mongoose');

const deliveryEntrySchema = new Schema({
  referenceType: String, // 'Sale', 'Shipment' — whatever this delivery was for
  referenceId: Schema.Types.ObjectId,
  revenue: { type: Number, required: true }, // the delivery income attributed to this specific stop
}, { _id: false });

// One vehicle's route for the day — the genuinely new mechanic: several
// deliveries can share ONE trip's fuel/cost, and profitability is computed
// across the WHOLE trip (total revenue from every delivery on it, minus
// the trip's real, actual costs), not per-delivery. Odometer readings
// (not an assumed distance) drive a real cost-per-km figure — the same
// "use the real measurement, not an estimate" principle Service Station's
// mileage tracking already established, applied here to cost efficiency
// instead of maintenance scheduling.
const deliveryTripSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'LogisticsVehicle', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  routeDescription: String,
  startOdometer: { type: Number, required: true },
  endOdometer: { type: Number, default: null },
  deliveries: [deliveryEntrySchema],
  fuelCost: { type: Number, default: null },
  otherCosts: { type: Number, default: null },
  distanceKm: { type: Number, default: null },
  totalRevenue: { type: Number, default: null },
  profitability: { type: Number, default: null },
  costPerKm: { type: Number, default: null },
  status: { type: String, default: 'planned', enum: ['planned', 'completed'] },
}, { timestamps: true });

module.exports = model('DeliveryTrip', deliveryTripSchema);
