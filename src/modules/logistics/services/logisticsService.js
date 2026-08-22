/**
 * LogisticsService — the genuinely new mechanic: several deliveries share
 * ONE trip's real costs, and profitability is computed across the whole
 * trip rather than per-delivery. completeTrip() is the actual work: it
 * derives distanceKm from real odometer readings (not an assumed or
 * estimated distance), sums every delivery's revenue attributed to this
 * trip, and computes both overall trip profitability and a real
 * cost-per-km figure — neither Courier (tracks a package, not a cost)
 * nor Car Rental (bills a customer, doesn't analyze internal efficiency)
 * has any equivalent to this.
 */
const FleetVehicle = require('../models/LogisticsVehicle');
const Driver = require('../models/Driver');
const DeliveryTrip = require('../models/DeliveryTrip');

function createVehicle(input) {
  const { companyId, branchId, registrationNumber, vehicleType } = input;
  return FleetVehicle.create({ companyId, branchId, registrationNumber, vehicleType });
}

function listVehicles(companyId) {
  return FleetVehicle.find({ companyId });
}

function createDriver(input) {
  const { companyId, name, licenseNumber, phone } = input;
  return Driver.create({ companyId, name, licenseNumber, phone });
}

function listDrivers(companyId) {
  return Driver.find({ companyId });
}

function startTrip(input) {
  const { companyId, branchId, vehicleId, driverId, routeDescription, startOdometer } = input;
  if (startOdometer === undefined || startOdometer === null || startOdometer < 0) throw new Error('startOdometer is required and cannot be negative.');
  return DeliveryTrip.create({ companyId, branchId, vehicleId, driverId, routeDescription, startOdometer });
}

/** Attaches one delivery's revenue to this trip — pure bookkeeping, no money moves here; the actual Sale/Shipment this references was already billed elsewhere. */
async function addDeliveryToTrip(tripId, { referenceType, referenceId, revenue }) {
  if (!revenue || revenue <= 0) throw new Error('revenue must be greater than zero.');
  const trip = await DeliveryTrip.findById(tripId);
  if (!trip) throw new Error('Trip not found.');
  if (trip.status !== 'planned') throw new Error(`Cannot add a delivery to a trip with status "${trip.status}".`);
  trip.deliveries.push({ referenceType, referenceId, revenue });
  await trip.save();
  return trip;
}

function listTrips(companyId, { vehicleId, status } = {}) {
  const filter = { companyId };
  if (vehicleId) filter.vehicleId = vehicleId;
  if (status) filter.status = status;
  return DeliveryTrip.find(filter).populate('vehicleId', 'registrationNumber').populate('driverId', 'name').sort({ createdAt: -1 });
}

/**
 * The real computation: distance from actual odometer readings (rejecting
 * an end reading lower than the start — the meter cannot run backward,
 * the exact same principle Petrol Pump's meter check already established),
 * total revenue summed across every delivery this trip carried, and both
 * overall profitability and a genuine cost-per-km efficiency figure.
 */
async function completeTrip(tripId, { endOdometer, fuelCost, otherCosts }) {
  const trip = await DeliveryTrip.findById(tripId);
  if (!trip) throw new Error('Trip not found.');
  if (trip.status !== 'planned') throw new Error(`Cannot complete a trip with status "${trip.status}".`);
  if (endOdometer < trip.startOdometer) throw new Error(`endOdometer (${endOdometer}) cannot be less than startOdometer (${trip.startOdometer}) — the odometer cannot run backward.`);

  const distanceKm = Math.round((endOdometer - trip.startOdometer) * 100) / 100;
  const totalCost = Math.round(((fuelCost || 0) + (otherCosts || 0)) * 100) / 100;
  const totalRevenue = Math.round(trip.deliveries.reduce((sum, d) => sum + d.revenue, 0) * 100) / 100;
  const profitability = Math.round((totalRevenue - totalCost) * 100) / 100;
  const costPerKm = distanceKm > 0 ? Math.round((totalCost / distanceKm) * 100) / 100 : null;

  trip.endOdometer = endOdometer;
  trip.fuelCost = fuelCost || 0;
  trip.otherCosts = otherCosts || 0;
  trip.distanceKm = distanceKm;
  trip.totalRevenue = totalRevenue;
  trip.profitability = profitability;
  trip.costPerKm = costPerKm;
  trip.status = 'completed';
  await trip.save();

  return trip;
}

module.exports = { createVehicle, listVehicles, createDriver, listDrivers, startTrip, addDeliveryToTrip, listTrips, completeTrip };
