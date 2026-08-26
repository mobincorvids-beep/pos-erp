/**
 * FleetService — core cross-industry vehicle/driver management. Generalizes
 * what used to live duplicated inside car_rental's FleetVehicle (rented OUT
 * to customers) and logistics' LogisticsVehicle (delivery cost tracking):
 * this is the standalone version for ANY business with company-owned
 * vehicles — registration, fuel spend (posts a real expense voucher, same
 * pattern as maintenanceService's parts consumption), and trip logging.
 *
 * Note on MaintenanceWorkOrder linkage: MaintenanceWorkOrder is tied to
 * FixedAsset, not to Vehicle — there is no real link between the two
 * models today. vehicleHistory() below does NOT fabricate one; it returns
 * fuel logs and trips only, honestly, rather than guessing at a join that
 * doesn't exist in the schema.
 */
const mongoose = require('mongoose');
const Vehicle = require('../models/CompanyVehicle');
const FuelLog = require('../models/FuelLog');
const VehicleTrip = require('../models/VehicleTrip');
const accountingService = require('./accountingService');

async function registerVehicle({ companyId, branchId, registrationNumber, make, model, year, type, assignedDriverId, odometerReading, fuelType, notes }) {
  if (!registrationNumber || !registrationNumber.trim()) throw new Error('registrationNumber is required.');
  return Vehicle.create({
    companyId, branchId: branchId || null, registrationNumber: registrationNumber.trim(),
    make, model, year: year || null, type: type || 'car',
    assignedDriverId: assignedDriverId || null, odometerReading: odometerReading || 0,
    fuelType: fuelType || 'petrol', notes: notes || '',
  });
}

function listVehicles(companyId, { status, type } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (type) filter.type = type;
  return Vehicle.find(filter).populate('assignedDriverId', 'name').sort({ createdAt: -1 });
}

async function getVehicle(companyId, vehicleId) {
  const vehicle = await Vehicle.findOne({ _id: vehicleId, companyId }).populate('assignedDriverId', 'name');
  if (!vehicle) throw new Error('Vehicle not found.');
  return vehicle;
}

async function updateVehicle(companyId, vehicleId, { make, model, year, type, assignedDriverId, odometerReading, fuelType, notes, branchId }) {
  const vehicle = await Vehicle.findOne({ _id: vehicleId, companyId });
  if (!vehicle) throw new Error('Vehicle not found.');
  if (make !== undefined) vehicle.make = make;
  if (model !== undefined) vehicle.model = model;
  if (year !== undefined) vehicle.year = year;
  if (type !== undefined) vehicle.type = type;
  if (branchId !== undefined) vehicle.branchId = branchId;
  if (assignedDriverId !== undefined) vehicle.assignedDriverId = assignedDriverId || null;
  if (odometerReading !== undefined) vehicle.odometerReading = odometerReading;
  if (fuelType !== undefined) vehicle.fuelType = fuelType;
  if (notes !== undefined) vehicle.notes = notes;
  await vehicle.save();
  return vehicle;
}

async function updateVehicleStatus(companyId, vehicleId, status) {
  if (!['active', 'maintenance', 'retired'].includes(status)) throw new Error('Invalid status.');
  const vehicle = await Vehicle.findOneAndUpdate({ _id: vehicleId, companyId }, { $set: { status } }, { new: true });
  if (!vehicle) throw new Error('Vehicle not found.');
  return vehicle;
}

function retireVehicle(companyId, vehicleId) {
  return updateVehicleStatus(companyId, vehicleId, 'retired');
}

function listFuelLogs(companyId, { vehicleId } = {}) {
  const filter = { companyId };
  if (vehicleId) filter.vehicleId = vehicleId;
  return FuelLog.find(filter).populate('vehicleId', 'registrationNumber').sort({ date: -1 });
}

/**
 * Records a refueling and posts a real expense voucher (Dr expense,
 * Cr paymentAccountId) — same "no guessing which account" discipline
 * maintenanceService's completeWorkOrder follows. Also rolls the
 * vehicle's odometerReading forward if this reading is higher.
 */
async function logFuel({ companyId, branchId, vehicleId, date, odometerReading, quantity, cost, expenseAccountId, paymentAccountId, userId }) {
  const session = await mongoose.startSession();
  try {
    let fuelLog;
    await session.withTransaction(async () => {
      const vehicle = await Vehicle.findOne({ _id: vehicleId, companyId }).session(session);
      if (!vehicle) throw new Error('Vehicle not found.');
      if (!quantity || quantity <= 0) throw new Error('quantity must be greater than zero.');
      if (!cost || cost <= 0) throw new Error('cost must be greater than zero.');
      if (!expenseAccountId || !paymentAccountId) throw new Error('expenseAccountId and paymentAccountId are required.');

      const [created] = await FuelLog.create([{
        companyId, branchId: branchId || vehicle.branchId || null, vehicleId,
        date: date || new Date(), odometerReading, quantity, cost, paymentAccountId, userId,
      }], { session });
      fuelLog = created;

      const voucher = await accountingService.postVoucher({
        companyId, branchId: branchId || vehicle.branchId, type: 'payment',
        narration: `Fuel — ${vehicle.registrationNumber}`,
        entries: [
          { accountId: expenseAccountId, debit: cost, credit: 0 },
          { accountId: paymentAccountId, debit: 0, credit: cost },
        ],
        referenceType: 'FuelLog', referenceId: fuelLog._id, userId,
      }, session);
      fuelLog.voucherId = voucher._id;
      await fuelLog.save({ session });

      if (odometerReading !== undefined && odometerReading > vehicle.odometerReading) {
        vehicle.odometerReading = odometerReading;
        await vehicle.save({ session });
      }
    });
    return fuelLog;
  } finally {
    session.endSession();
  }
}

function listTrips(companyId, { vehicleId, status } = {}) {
  const filter = { companyId };
  if (vehicleId) filter.vehicleId = vehicleId;
  if (status) filter.status = status;
  return VehicleTrip.find(filter).populate('vehicleId', 'registrationNumber').populate('driverId', 'name').sort({ startTime: -1 });
}

async function startTrip({ companyId, branchId, vehicleId, driverId, purpose, destination, startOdometer, userId }) {
  const vehicle = await Vehicle.findOne({ _id: vehicleId, companyId });
  if (!vehicle) throw new Error('Vehicle not found.');
  if (vehicle.status !== 'active') throw new Error(`Cannot start a trip — vehicle status is "${vehicle.status}".`);
  return VehicleTrip.create({
    companyId, branchId: branchId || vehicle.branchId || null, vehicleId,
    driverId: driverId || null, purpose: purpose || '', destination: destination || '',
    startOdometer: startOdometer !== undefined ? startOdometer : vehicle.odometerReading,
    startTime: new Date(), status: 'in_progress', userId,
  });
}

/** Completes a trip and computes distance from the odometer readings; rolls the vehicle's own odometerReading forward. */
async function completeTrip(tripId, { endOdometer, notes }) {
  const trip = await VehicleTrip.findById(tripId);
  if (!trip) throw new Error('Trip not found.');
  if (trip.status !== 'in_progress' && trip.status !== 'scheduled') throw new Error(`Cannot complete a trip with status "${trip.status}".`);
  if (endOdometer === undefined || endOdometer === null) throw new Error('endOdometer is required.');
  if (endOdometer < trip.startOdometer) throw new Error('endOdometer cannot be less than startOdometer.');

  trip.endOdometer = endOdometer;
  trip.endTime = new Date();
  trip.status = 'completed';
  if (notes !== undefined) trip.notes = notes;
  await trip.save();

  await Vehicle.findOneAndUpdate(
    { _id: trip.vehicleId, odometerReading: { $lt: endOdometer } },
    { $set: { odometerReading: endOdometer } }
  );

  return trip;
}

function cancelTrip(tripId) {
  return VehicleTrip.findOneAndUpdate(
    { _id: tripId, status: { $in: ['scheduled', 'in_progress'] } },
    { $set: { status: 'cancelled', endTime: new Date() } },
    { new: true }
  );
}

/** distance = endOdometer - startOdometer, derived, never stored. */
function tripDistance(trip) {
  if (trip.endOdometer === null || trip.endOdometer === undefined) return null;
  return trip.endOdometer - trip.startOdometer;
}

/** Real fuel + trip history for a vehicle. See file-level note above re: MaintenanceWorkOrder — honestly not linked, so not included. */
async function vehicleHistory(companyId, vehicleId) {
  const vehicle = await Vehicle.findOne({ _id: vehicleId, companyId });
  if (!vehicle) throw new Error('Vehicle not found.');
  const [fuelLogs, trips] = await Promise.all([
    FuelLog.find({ companyId, vehicleId }).sort({ date: -1 }),
    VehicleTrip.find({ companyId, vehicleId }).sort({ startTime: -1 }),
  ]);
  const totalFuelCost = fuelLogs.reduce((sum, f) => sum + f.cost, 0);
  const totalDistance = trips.reduce((sum, t) => sum + (tripDistance(t) || 0), 0);
  return { vehicle, fuelLogs, trips, totalFuelCost, totalDistance };
}

module.exports = {
  registerVehicle, listVehicles, getVehicle, updateVehicle, updateVehicleStatus, retireVehicle,
  listFuelLogs, logFuel,
  listTrips, startTrip, completeTrip, cancelTrip,
  vehicleHistory,
};
