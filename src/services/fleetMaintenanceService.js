/**
 * FleetMaintenanceService — closes the "no maintenance scheduling /
 * compliance-expiry alerts" gap: recurring service due-dates (mileage
 * and/or time based) for CompanyVehicle, plus expiry alerts for the
 * vehicle-level compliance documents (registration, insurance, permits,
 * fitness certificates) added to CompanyVehicle. Both sweeps feed into
 * the same notificationService.notify() mechanism driverService's
 * document-expiry sweep already uses, targeted at whichever role has
 * fleet.manage — no second alerting engine.
 */
const VehicleMaintenanceSchedule = require('../models/VehicleMaintenanceSchedule');
const CompanyVehicle = require('../models/CompanyVehicle');
const Role = require('../models/Role');
const notificationService = require('./notificationService');

async function createSchedule(input) {
  const vehicle = await CompanyVehicle.findOne({ _id: input.vehicleId, companyId: input.companyId });
  if (!vehicle) throw new Error('Vehicle not found.');
  if (!input.intervalKm && !input.intervalDays) {
    throw new Error('A maintenance schedule needs at least one of intervalKm or intervalDays.');
  }

  const nextDueOdometer = input.intervalKm ? vehicle.odometerReading + input.intervalKm : null;
  const nextDueDate = input.intervalDays ? new Date(Date.now() + input.intervalDays * 24 * 60 * 60 * 1000) : null;

  return VehicleMaintenanceSchedule.create({
    ...input,
    lastServiceOdometer: vehicle.odometerReading,
    lastServiceDate: new Date(),
    nextDueOdometer,
    nextDueDate,
  });
}

function listSchedules(companyId, { vehicleId, isActive } = {}) {
  const filter = { companyId };
  if (vehicleId) filter.vehicleId = vehicleId;
  if (isActive !== undefined) filter.isActive = isActive;
  return VehicleMaintenanceSchedule.find(filter).populate('vehicleId', 'registrationNumber make model').sort({ nextDueDate: 1 });
}

/**
 * Advances a schedule's baseline after a service is actually performed —
 * recomputes both next-due fields from whichever intervals are set, and
 * resets dueNotified so the next approach gets its own alert.
 */
async function recordServiceCompleted(scheduleId, companyId, { odometerAtService, serviceDate } = {}) {
  const schedule = await VehicleMaintenanceSchedule.findOne({ _id: scheduleId, companyId });
  if (!schedule) throw new Error('Maintenance schedule not found.');

  const vehicle = await CompanyVehicle.findById(schedule.vehicleId);
  const effectiveOdometer = odometerAtService ?? vehicle?.odometerReading ?? schedule.lastServiceOdometer;
  const effectiveDate = serviceDate ? new Date(serviceDate) : new Date();

  schedule.lastServiceOdometer = effectiveOdometer;
  schedule.lastServiceDate = effectiveDate;
  schedule.nextDueOdometer = schedule.intervalKm != null ? effectiveOdometer + schedule.intervalKm : null;
  schedule.nextDueDate = schedule.intervalDays != null
    ? new Date(effectiveDate.getTime() + schedule.intervalDays * 24 * 60 * 60 * 1000)
    : null;
  schedule.dueNotified = false;
  return schedule.save();
}

/**
 * Finds schedules due (or overdue) by mileage — needs the vehicle's
 * CURRENT odometer, so it's evaluated per-vehicle rather than as a single
 * query, and by time (a plain date range query). Both paths notify once
 * (dueNotified) until recordServiceCompleted() resets it.
 */
async function getDueMaintenanceSchedules(companyId, { withinDays = 14, notify = false } = {}) {
  const schedules = await VehicleMaintenanceSchedule.find({ companyId, isActive: true }).populate('vehicleId', 'registrationNumber odometerReading');
  const cutoffDate = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const due = schedules.filter((s) => {
    const vehicle = s.vehicleId;
    if (!vehicle) return false;
    const kmDue = s.nextDueOdometer != null && vehicle.odometerReading >= s.nextDueOdometer;
    const dateDue = s.nextDueDate != null && s.nextDueDate <= cutoffDate;
    return kmDue || dateDue;
  });

  if (notify && due.length > 0) {
    const roles = await Role.find({ companyId, permissions: { $in: ['fleet.manage', '*'] } });
    for (const schedule of due) {
      if (schedule.dueNotified) continue;
      for (const role of roles) {
        await notificationService.notify({
          companyId, roleId: role._id, type: 'vehicle_maintenance_due',
          title: `Maintenance due: ${schedule.name}`,
          message: `${schedule.vehicleId.registrationNumber} is due for "${schedule.name}"${schedule.nextDueDate ? ` by ${schedule.nextDueDate.toDateString()}` : ''}${schedule.nextDueOdometer ? ` or at ${schedule.nextDueOdometer}km` : ''}.`,
          entityType: 'VehicleMaintenanceSchedule', entityId: schedule._id,
        });
      }
      schedule.dueNotified = true;
      await schedule.save();
    }
  }

  return due;
}

/** Vehicle-level compliance-document expiry sweep — same shape/posture as driverService.getExpiringDriverDocuments(). */
async function getExpiringVehicleCompliance(companyId, withinDays = 30) {
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const vehicles = await CompanyVehicle.find({
    companyId,
    'complianceDocuments.expiryDate': { $ne: null, $lte: cutoff, $gte: now },
    'complianceDocuments.expiryNotified': false,
  });

  if (vehicles.length === 0) return { notifiedCount: 0, items: [] };

  const roles = await Role.find({ companyId, permissions: { $in: ['fleet.manage', '*'] } });
  let notifiedCount = 0;
  const items = [];

  for (const vehicle of vehicles) {
    for (const doc of vehicle.complianceDocuments) {
      if (doc.expiryDate && !doc.expiryNotified && doc.expiryDate <= cutoff && doc.expiryDate >= now) {
        const daysRemaining = Math.ceil((doc.expiryDate - now) / (1000 * 60 * 60 * 24));
        for (const role of roles) {
          await notificationService.notify({
            companyId, roleId: role._id, type: 'vehicle_compliance_expiring',
            title: `${doc.label} expiring in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
            message: `${vehicle.registrationNumber}'s ${doc.label.toLowerCase()} (${doc.documentNumber || 'no number on file'}) expires on ${doc.expiryDate.toDateString()}.`,
            entityType: 'CompanyVehicle', entityId: vehicle._id,
          });
        }
        doc.expiryNotified = true;
        notifiedCount += 1;
        items.push({ vehicleId: vehicle._id, registrationNumber: vehicle.registrationNumber, document: doc.label, expiryDate: doc.expiryDate });
      }
    }
    await vehicle.save();
  }

  return { notifiedCount, items };
}

module.exports = {
  createSchedule,
  listSchedules,
  recordServiceCompleted,
  getDueMaintenanceSchedules,
  getExpiringVehicleCompliance,
};
