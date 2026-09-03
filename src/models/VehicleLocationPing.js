const { Schema, model } = require('mongoose');

// Append-only ingestion record of one GPS fix for a company vehicle. This
// is deliberately JUST the storage/ingestion hook (recordVehiclePing) plus
// a "most recent per vehicle" read (getLatestVehicleLocations) — no actual
// GPS hardware/device integration, geofencing, or route-replay UI is built
// here, per the gap spec. A high-frequency tracker could write many of
// these per minute per vehicle; nothing here caps or downsamples that, so
// a real deployment wanting long retention should add a TTL index or a
// periodic prune job before turning on frequent pings at scale.
const vehicleLocationPingSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'CompanyVehicle', required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  speed: { type: Number, default: null }, // km/h, when the source device reports it
  recordedAt: { type: Date, default: Date.now }, // when the FIX was taken (device clock), distinct from createdAt (when it reached this server)
}, { timestamps: true });

vehicleLocationPingSchema.index({ companyId: 1, vehicleId: 1, recordedAt: -1 });

module.exports = model('VehicleLocationPing', vehicleLocationPingSchema);
