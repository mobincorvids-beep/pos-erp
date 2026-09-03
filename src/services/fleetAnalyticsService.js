/**
 * FleetAnalyticsService — read-only fuel-efficiency reporting plus
 * customer-facing freight/per-km costing. Deliberately separate from
 * fleetService.js (which owns the CRUD/mutations on Vehicle/FuelLog/
 * VehicleTrip): this file only ever reads those models and a new
 * FreightRate config, never writes to fleet data.
 */
const Vehicle = require('../models/CompanyVehicle');
const FuelLog = require('../models/FuelLog');
const VehicleTrip = require('../models/VehicleTrip');
const FreightRate = require('../models/FreightRate');

/** distance = endOdometer - startOdometer, same derivation fleetService.tripDistance uses. */
function tripDistance(trip) {
  if (trip.endOdometer === null || trip.endOdometer === undefined) return null;
  return trip.endOdometer - trip.startOdometer;
}

/**
 * km/liter per vehicle over [from, to], plus a fleet-wide average, with
 * any vehicle whose efficiency falls more than `thresholdPct` below that
 * average flagged as a cheap possible-theft/leakage proxy. Distance comes
 * from completed VehicleTrip odometer deltas in the window; fuel comes
 * from FuelLog.quantity in the same window — both already company-scoped,
 * real, existing fields, nothing invented here.
 */
async function fuelEfficiencyReport(companyId, { from, to, thresholdPct = 20 } = {}) {
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);

  const tripFilter = { companyId, status: 'completed' };
  if (from || to) tripFilter.startTime = dateFilter;
  const fuelFilter = { companyId };
  if (from || to) fuelFilter.date = dateFilter;

  const [vehicles, trips, fuelLogs] = await Promise.all([
    Vehicle.find({ companyId }),
    VehicleTrip.find(tripFilter),
    FuelLog.find(fuelFilter),
  ]);

  const distanceByVehicle = new Map();
  for (const trip of trips) {
    const d = tripDistance(trip);
    if (!d || d <= 0) continue;
    const key = String(trip.vehicleId);
    distanceByVehicle.set(key, (distanceByVehicle.get(key) || 0) + d);
  }

  const fuelByVehicle = new Map();
  const costByVehicle = new Map();
  for (const log of fuelLogs) {
    const key = String(log.vehicleId);
    fuelByVehicle.set(key, (fuelByVehicle.get(key) || 0) + log.quantity);
    costByVehicle.set(key, (costByVehicle.get(key) || 0) + log.cost);
  }

  const rows = [];
  for (const vehicle of vehicles) {
    const key = String(vehicle._id);
    const distanceKm = distanceByVehicle.get(key) || 0;
    const fuelConsumed = fuelByVehicle.get(key) || 0;
    const fuelCost = costByVehicle.get(key) || 0;
    // Only report a km/liter figure where both sides of the ratio are
    // real for this vehicle in this window — a vehicle with trips but no
    // fuel logs (or vice versa) gets kmPerLiter: null rather than a
    // fabricated 0 or Infinity.
    const kmPerLiter = distanceKm > 0 && fuelConsumed > 0 ? distanceKm / fuelConsumed : null;
    rows.push({
      vehicleId: vehicle._id,
      registrationNumber: vehicle.registrationNumber,
      distanceKm, fuelConsumed, fuelCost, kmPerLiter,
    });
  }

  const measured = rows.filter(r => r.kmPerLiter !== null);
  const fleetAverageKmPerLiter = measured.length
    ? measured.reduce((sum, r) => sum + r.kmPerLiter, 0) / measured.length
    : null;

  for (const row of rows) {
    row.flagged = false;
    row.deviationPct = null;
    if (row.kmPerLiter !== null && fleetAverageKmPerLiter) {
      row.deviationPct = ((row.kmPerLiter - fleetAverageKmPerLiter) / fleetAverageKmPerLiter) * 100;
      // More than `thresholdPct` BELOW the fleet average — a cheap,
      // approximate signal worth a human look, not a proven finding
      // (a vehicle doing mostly short/idling trips would also trip this).
      if (row.deviationPct <= -Math.abs(thresholdPct)) row.flagged = true;
    }
  }

  return {
    from: from ? new Date(from) : null,
    to: to ? new Date(to) : null,
    thresholdPct,
    fleetAverageKmPerLiter,
    vehicles: rows.sort((a, b) => (a.kmPerLiter ?? Infinity) - (b.kmPerLiter ?? Infinity)),
    flaggedCount: rows.filter(r => r.flagged).length,
  };
}

function getActiveFreightRate(companyId) {
  return FreightRate.findOne({ companyId, isActive: true }).sort({ createdAt: -1 });
}

function listFreightRates(companyId) {
  return FreightRate.find({ companyId }).sort({ createdAt: -1 });
}

async function setFreightRate(companyId, { ratePerKm, ratePerKg, minimumCharge, currency, notes }) {
  if (ratePerKm === undefined || ratePerKm === null || ratePerKm < 0) throw new Error('ratePerKm is required and must be >= 0.');
  // Deactivate whatever was active before, then create the new one — keeps
  // every past rate card around (so a historical quote's provenance is
  // still inspectable) rather than mutating a shared row in place.
  await FreightRate.updateMany({ companyId, isActive: true }, { $set: { isActive: false } });
  return FreightRate.create({
    companyId, ratePerKm, ratePerKg: ratePerKg || 0,
    minimumCharge: minimumCharge || 0, currency: currency || 'PKR', notes: notes || '',
    isActive: true,
  });
}

/**
 * Quotes a customer-facing freight/delivery charge for a given distance
 * (and, optionally, weight — this app has no cargo-weight field stored
 * anywhere on Vehicle/Trip, so weightKg is purely a caller-supplied input,
 * e.g. from the SalesOrder/delivery line being created) off the company's
 * active FreightRate config.
 */
async function quoteFreight(companyId, { distanceKm, weightKg } = {}) {
  if (distanceKm === undefined || distanceKm === null || distanceKm <= 0) throw new Error('distanceKm is required and must be greater than zero.');
  const rate = await getActiveFreightRate(companyId);
  if (!rate) throw new Error('No active freight rate configured for this company. Set one via POST /fleet/freight-rate first.');

  const distanceCharge = distanceKm * rate.ratePerKm;
  const weightCharge = weightKg && weightKg > 0 && rate.ratePerKg > 0 ? weightKg * rate.ratePerKg : 0;
  const subtotal = distanceCharge + weightCharge;
  const total = Math.max(subtotal, rate.minimumCharge || 0);

  return {
    distanceKm, weightKg: weightKg || null,
    ratePerKm: rate.ratePerKm, ratePerKg: rate.ratePerKg,
    distanceCharge, weightCharge, minimumCharge: rate.minimumCharge || 0,
    total, currency: rate.currency, freightRateId: rate._id,
  };
}

module.exports = {
  fuelEfficiencyReport,
  getActiveFreightRate, listFreightRates, setFreightRate, quoteFreight,
};
