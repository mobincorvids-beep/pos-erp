const { Schema, model } = require('mongoose');

/**
 * CORE cross-industry shipment record — any tenant fulfilling outbound
 * deliveries to a customer can use this, not just courier/logistics
 * industry-type tenants (see src/modules/courier and src/modules/logistics
 * for the industry-specific booking/fleet-costing modules; this is the
 * generic "a sale needs to physically get to a customer" layer they don't
 * provide on their own for a retail/grocery/electronics/etc. tenant).
 *
 * Deliberately isolated from the industry modules: no dependency on their
 * models, and registered as 'Shipment' / 'ShipmentEvent' — names not used
 * by src/modules/courier or src/modules/logistics (confirmed by reading
 * their models/ directories first).
 *
 * Full picture of every vehicle/shipment-shaped model in this codebase
 * (documented here once rather than in each file, since a reader landing
 * on any one of them needs the same map):
 *   - CompanyVehicle (this layer)      — the company's OWN vehicle asset:
 *     registration/condition/odometer. No rental/costing concept.
 *   - CoreShipment / ShipmentEvent (this layer) — a generic outbound
 *     delivery for ANY tenant, cross-industry, no cost/profitability model.
 *   - ProofOfDelivery (this layer)     — structured delivery capture
 *     (signature/photo/recipient/GPS) against a CoreShipment; see
 *     logisticsService.recordDelivery().
 *   - VehicleLocationPing (this layer) — raw GPS ingestion stream keyed to
 *     CompanyVehicle; see fleetGpsService.js.
 *   - Driver (this layer)              — license/document profile,
 *     optionally linked from CompanyVehicle/VehicleTrip/VehicleIncident via
 *     driverProfileId (additive, alongside their pre-existing User-ref
 *     driverId/assignedDriverId fields).
 *   - src/modules/car_rental/models/FleetVehicle.js — a POOL of
 *     interchangeable vehicles booked by CLASS ("any compact car"), billed
 *     a daily rental rate to a customer. Genuinely different booking
 *     mechanic (pool-availability search) from everything above.
 *   - src/modules/logistics/models/LogisticsVehicle.js — the company's own
 *     delivery vehicle, but scoped to per-trip cost-vs-earnings tracking
 *     for the Logistics industry module specifically (this layer's
 *     CompanyVehicle/FleetAnalyticsService now covers that same fuel-
 *     efficiency/freight-costing need generically — LogisticsVehicle
 *     predates it and is kept for industry-module back-compat rather than
 *     force-migrated, per the same low-risk-only consolidation policy this
 *     round's audit used elsewhere).
 *   - src/modules/courier/models/Shipment.js — ONE package's strict
 *     one-way status chain with an immutable history log; a fundamentally
 *     different data shape (single package, not a customer delivery) from
 *     CoreShipment.
 *   - src/modules/service_station/models/Vehicle.js — a CUSTOMER-owned
 *     vehicle being serviced (mileage-based service-due triggers). Not a
 *     company asset at all — unrelated concept, confirmed distinct.
 *   - src/modules/auto_parts/models/VehicleFitment.js — a catalog fact
 *     ("this part fits this make/model/year"), not a real vehicle record.
 *   - src/modules/import_export/models/ImportShipment.js — a customs/
 *     import consignment (HS codes, duties, customs clearance stages), not
 *     a delivery-to-customer shipment.
 * Every split above is a genuinely different mechanic/audience, not
 * incidental duplication — no consolidation was made. LogisticsVehicle is
 * the one row that's arguably supersede-able by CompanyVehicle now, but
 * migrating a live industry module's foreign-key references is exactly the
 * kind of "risky merge" this round's instructions say to leave documented
 * rather than force.
 */
const addressSchema = new Schema({
  name: { type: String, default: '' },
  line1: { type: String, default: '' },
  line2: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  postalCode: { type: String, default: '' },
  country: { type: String, default: '' },
  phone: { type: String, default: '' },
}, { _id: false });

// 'packed' and 'shipped' were added for the warehouse pack/ship workflow
// (see src/services/packShipService.js) — a shipment created from a
// completed PickWave moves pending -> packed -> shipped -> ... the same
// way any other shipment does, they're just two extra waypoints ahead of
// 'picked_up' for a tenant that packs at the warehouse before a carrier
// physically picks the parcel up. Existing shipments/flows that never use
// 'packed'/'shipped' are completely unaffected.
const SHIPMENT_STATUSES = ['pending', 'packed', 'shipped', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'];

const shipmentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },

  shipmentNumber: { type: String, required: true },

  // A shipment fulfills a sale, but standalone shipments (not tied to a
  // core Sale — e.g. a return pickup, a sample delivery) are also valid.
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },

  origin: { type: addressSchema, default: () => ({}) },
  destination: { type: addressSchema, default: () => ({}) },

  carrierName: { type: String, default: '' },
  trackingNumber: { type: String, default: '' },

  status: { type: String, enum: SHIPMENT_STATUSES, default: 'pending', index: true },

  weight: { type: Number, default: null },
  dimensions: {
    length: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    unit: { type: String, default: 'cm' },
  },
  shippingCost: { type: Number, default: 0 },

  // Reuses the core CompanyVehicle/User models (see src/models/CompanyVehicle.js)
  // rather than duplicating driver/vehicle concepts inside this module.
  assignedDriverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  assignedVehicleId: { type: Schema.Types.ObjectId, ref: 'CompanyVehicle', default: null },

  podNote: { type: String, default: '' },
  deliveredAt: { type: Date, default: null },

  // Warehouse pack/ship workflow linkage (see src/services/packShipService.js).
  // Null for every shipment not created from a pick wave — purely additive.
  pickWaveId: { type: Schema.Types.ObjectId, ref: 'PickWave', default: null, index: true },
  packedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  packedAt: { type: Date, default: null },
  shippedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  shippedAt: { type: Date, default: null },
}, { timestamps: true });

shipmentSchema.index({ companyId: 1, shipmentNumber: 1 }, { unique: true });
shipmentSchema.index({ companyId: 1, trackingNumber: 1 });
shipmentSchema.index({ companyId: 1, status: 1 });

shipmentSchema.statics.STATUSES = SHIPMENT_STATUSES;

module.exports = model('CoreShipment', shipmentSchema);
