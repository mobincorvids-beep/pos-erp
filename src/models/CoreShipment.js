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

const SHIPMENT_STATUSES = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'];

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
}, { timestamps: true });

shipmentSchema.index({ companyId: 1, shipmentNumber: 1 }, { unique: true });
shipmentSchema.index({ companyId: 1, trackingNumber: 1 });
shipmentSchema.index({ companyId: 1, status: 1 });

shipmentSchema.statics.STATUSES = SHIPMENT_STATUSES;

module.exports = model('CoreShipment', shipmentSchema);
