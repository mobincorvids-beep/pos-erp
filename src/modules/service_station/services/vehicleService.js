/**
 * VehicleService — vehicle registration, mileage tracking, and
 * mileage/date-based service-due detection. Job cards themselves stay in
 * core ServiceOrder (parts, labor, billing — all unchanged, reused as-is);
 * this module only adds the vehicle context (which asset, what's its
 * service history, is it due) around that existing workflow, tagging job
 * cards via the optional ServiceOrder.vehicleId field.
 */
const mongoose = require('mongoose');
const Vehicle = require('../models/Vehicle');
const ServiceOrder = require('../../../models/ServiceOrder');
const serviceOrderService = require('../../../services/serviceOrderService');

function registerVehicle(input) {
  const { companyId, customerId, make, model: modelName, year, registrationNumber, currentMileage, serviceIntervalMileage, serviceIntervalMonths } = input;
  if (!customerId || !registrationNumber) throw new Error('customerId and registrationNumber are required.');
  return Vehicle.create({
    companyId, customerId, make, model: modelName, year, registrationNumber,
    currentMileage: currentMileage || 0,
    serviceIntervalMileage: serviceIntervalMileage || 5000,
    serviceIntervalMonths: serviceIntervalMonths || 6,
  });
}

function listVehicles(companyId, customerId) {
  const filter = { companyId };
  if (customerId) filter.customerId = customerId;
  return Vehicle.find(filter).populate('customerId', 'name');
}

/** Odometer readings only ever go forward — a lower new reading is almost always a data-entry mistake, not a real event. */
async function updateMileage(vehicleId, newMileage) {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new Error('Vehicle not found.');
  if (newMileage < vehicle.currentMileage) {
    throw new Error(`New mileage (${newMileage}) is less than the recorded current mileage (${vehicle.currentMileage}) — an odometer doesn't go backward; check for a data-entry mistake.`);
  }
  vehicle.currentMileage = newMileage;
  await vehicle.save();
  return vehicle;
}

/**
 * Creates a job card (core ServiceOrder) tagged with this vehicle — a thin
 * wrapper, not a reimplementation; every actual job-card mechanic (parts,
 * labor, billing, status flow) is exactly the core Service Management module.
 */
function openJobCard(input) {
  return serviceOrderService.create(input); // input already includes vehicleId
}

/**
 * Records that a job card completed real service work on this vehicle —
 * advances lastServiceMileage/Date and recomputes both "next due" triggers
 * from them. Distinct from just updating mileage: this is what actually
 * resets the service clock, mileage tracking alone doesn't.
 */
async function recordServiceCompleted(vehicleId, { serviceOrderId, mileageAtService, serviceDate }) {
  const session = await mongoose.startSession();
  try {
    let vehicle;
    await session.withTransaction(async () => {
      vehicle = await Vehicle.findById(vehicleId).session(session);
      if (!vehicle) throw new Error('Vehicle not found.');

      if (serviceOrderId) {
        const so = await ServiceOrder.findOne({ _id: serviceOrderId, vehicleId }).session(session);
        if (!so) throw new Error('That service order is not linked to this vehicle.');
      }

      const effectiveMileage = mileageAtService ?? vehicle.currentMileage;
      const effectiveDate = serviceDate ? new Date(serviceDate) : new Date();

      vehicle.lastServiceMileage = effectiveMileage;
      vehicle.lastServiceDate = effectiveDate;
      vehicle.currentMileage = Math.max(vehicle.currentMileage, effectiveMileage);
      vehicle.nextServiceDueMileage = effectiveMileage + vehicle.serviceIntervalMileage;
      vehicle.nextServiceDueDate = new Date(effectiveDate.getFullYear(), effectiveDate.getMonth() + vehicle.serviceIntervalMonths, effectiveDate.getDate());

      await vehicle.save({ session });
    });
    return vehicle;
  } finally {
    session.endSession();
  }
}

/**
 * Vehicles due for service — either trigger fires it, computed as a real
 * Mongo query (via $expr, comparing two fields on the SAME document)
 * rather than loading every vehicle into JS to check. A vehicle that's
 * never been serviced (nextServiceDueMileage/Date both null) is excluded —
 * "due" implies there's a baseline to be due FROM.
 */
function listServiceDue(companyId) {
  return Vehicle.find({
    companyId,
    $or: [
      { $expr: { $and: [{ $ne: ['$nextServiceDueMileage', null] }, { $gte: ['$currentMileage', '$nextServiceDueMileage'] }] } },
      { nextServiceDueDate: { $ne: null, $lte: new Date() } },
    ],
  }).populate('customerId', 'name');
}

function serviceHistory(vehicleId) {
  return ServiceOrder.find({ vehicleId }).sort({ createdAt: -1 });
}

module.exports = { registerVehicle, listVehicles, updateMileage, openJobCard, recordServiceCompleted, listServiceDue, serviceHistory };
