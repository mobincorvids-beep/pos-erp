/**
 * FleetGpsService — the ingestion/storage hook for GPS/real-time vehicle
 * tracking, deliberately separate from fleetService.js (which owns
 * CompanyVehicle/FuelLog/VehicleTrip CRUD): a location ping is a
 * high-frequency, append-only stream, a genuinely different write pattern
 * from the rest of fleet's low-frequency admin records. No actual GPS
 * hardware/device integration here — just recordVehiclePing() (what a
 * tracker device or driver app would POST to) and
 * getLatestVehicleLocations() (the read a live map view would poll).
 */
const Vehicle = require('../models/CompanyVehicle');
const VehicleLocationPing = require('../models/VehicleLocationPing');

async function recordVehiclePing(vehicleId, { companyId, lat, lng, speed, timestamp }) {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    throw new Error('lat and lng are required.');
  }
  const vehicle = await Vehicle.findOne({ _id: vehicleId, companyId });
  if (!vehicle) throw new Error('Vehicle not found.');

  return VehicleLocationPing.create({
    companyId, vehicleId,
    lat, lng, speed: speed ?? null,
    recordedAt: timestamp ? new Date(timestamp) : new Date(),
  });
}

/**
 * One row per vehicle: its single most-recent ping (by recordedAt), for
 * every vehicle in the company that has ever reported one. A vehicle with
 * no pings at all is simply absent from the result rather than padded with
 * a fabricated null row.
 */
async function getLatestVehicleLocations(companyId) {
  // A plain query + in-memory group-by rather than an aggregate pipeline —
  // this app has no other aggregate-pipeline precedent to mirror, and
  // pings-per-vehicle-per-company is a small, boundable set (capped below).
  const pings = await VehicleLocationPing.find({ companyId }).sort({ recordedAt: -1 }).limit(5000);
  const latestByVehicle = new Map();
  for (const ping of pings) {
    const key = String(ping.vehicleId);
    if (!latestByVehicle.has(key)) latestByVehicle.set(key, ping);
  }

  const vehicleIds = [...latestByVehicle.keys()];
  const vehicles = await Vehicle.find({ _id: { $in: vehicleIds } }).select('registrationNumber');
  const vehiclesById = new Map(vehicles.map((v) => [String(v._id), v]));

  return vehicleIds.map((id) => {
    const ping = latestByVehicle.get(id);
    const vehicle = vehiclesById.get(id);
    return {
      vehicleId: id,
      registrationNumber: vehicle ? vehicle.registrationNumber : null,
      lat: ping.lat, lng: ping.lng, speed: ping.speed, recordedAt: ping.recordedAt,
    };
  });
}

module.exports = { recordVehiclePing, getLatestVehicleLocations };
