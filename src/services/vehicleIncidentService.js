/**
 * VehicleIncidentService — CRUD for accident/damage/theft/other events
 * against a company vehicle. Kept separate from fleetService.js: incidents
 * are an unplanned, insurance-claim-adjacent record, not routine
 * fuel/trip/vehicle admin.
 */
const Vehicle = require('../models/CompanyVehicle');
const VehicleIncident = require('../models/VehicleIncident');

const TYPES = ['accident', 'damage', 'theft', 'other'];
const CLAIM_STATUSES = ['none', 'filed', 'approved', 'rejected', 'paid'];

function listIncidents(companyId, { vehicleId, type, claimStatus } = {}) {
  const filter = { companyId };
  if (vehicleId) filter.vehicleId = vehicleId;
  if (type) filter.type = type;
  if (claimStatus) filter.claimStatus = claimStatus;
  return VehicleIncident.find(filter)
    .populate('vehicleId', 'registrationNumber')
    .populate('driverId', 'name')
    .sort({ date: -1 });
}

async function getIncident(companyId, incidentId) {
  const incident = await VehicleIncident.findOne({ _id: incidentId, companyId })
    .populate('vehicleId', 'registrationNumber')
    .populate('driverId', 'name');
  if (!incident) throw new Error('Incident not found.');
  return incident;
}

async function createIncident({ companyId, vehicleId, driverId, date, type, description, estimatedCost, claimStatus, attachments, createdBy }) {
  if (!vehicleId) throw new Error('vehicleId is required.');
  if (!TYPES.includes(type)) throw new Error(`type must be one of: ${TYPES.join(', ')}.`);
  const vehicle = await Vehicle.findOne({ _id: vehicleId, companyId });
  if (!vehicle) throw new Error('Vehicle not found.');
  if (claimStatus && !CLAIM_STATUSES.includes(claimStatus)) throw new Error(`claimStatus must be one of: ${CLAIM_STATUSES.join(', ')}.`);

  return VehicleIncident.create({
    companyId, vehicleId, driverId: driverId || null,
    date: date ? new Date(date) : new Date(),
    type, description: description || '', estimatedCost: estimatedCost || 0,
    claimStatus: claimStatus || 'none', attachments: attachments || [], createdBy,
  });
}

async function updateIncident(companyId, incidentId, { driverId, date, type, description, estimatedCost, claimStatus, attachments }) {
  const incident = await VehicleIncident.findOne({ _id: incidentId, companyId });
  if (!incident) throw new Error('Incident not found.');
  if (type !== undefined) {
    if (!TYPES.includes(type)) throw new Error(`type must be one of: ${TYPES.join(', ')}.`);
    incident.type = type;
  }
  if (claimStatus !== undefined) {
    if (!CLAIM_STATUSES.includes(claimStatus)) throw new Error(`claimStatus must be one of: ${CLAIM_STATUSES.join(', ')}.`);
    incident.claimStatus = claimStatus;
  }
  if (driverId !== undefined) incident.driverId = driverId || null;
  if (date !== undefined) incident.date = new Date(date);
  if (description !== undefined) incident.description = description;
  if (estimatedCost !== undefined) incident.estimatedCost = estimatedCost;
  if (attachments !== undefined) incident.attachments = attachments;
  await incident.save();
  return incident;
}

module.exports = { listIncidents, getIncident, createIncident, updateIncident, TYPES, CLAIM_STATUSES };
