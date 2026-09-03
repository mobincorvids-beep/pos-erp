const { Schema, model } = require('mongoose');

// A tiny, standalone per-company config for quoting a customer-facing
// freight/delivery charge off the company's OWN fleet running costs.
// Deliberately NOT added onto Company.js's settings block — this is a
// fleet-module concern, not a core company setting, and keeping it as its
// own tiny collection (one active document per company, same
// "singleton-per-company config" shape as things like ecommerceConfig,
// just in its own collection instead of nested on Company) avoids growing
// an unrelated model for a single new number.
const freightRateSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  // Charged per km of distance travelled — the only rate every quote can
  // always use, since CompanyVehicle/VehicleTrip always have odometer
  // distance but never necessarily a cargo weight.
  ratePerKm: { type: Number, required: true },
  // Optional — only applied when the caller actually passes a weightKg
  // (this app tracks no cargo-weight field anywhere on Vehicle/Trip, so
  // this rate only ever comes into play when the CALLER supplies a
  // weight, e.g. from a SalesOrder line, not from anything stored here).
  ratePerKg: { type: Number, default: 0 },
  minimumCharge: { type: Number, default: 0 },
  currency: { type: String, default: 'PKR' },
  isActive: { type: Boolean, default: true },
  notes: { type: String, default: '' },
}, { timestamps: true });

// One active rate card per company at a time — quoteFreight always reads
// the single active one; a company that wants a new rate deactivates the
// old row and creates a new one, keeping history intact (never overwrites
// past quotes' provenance).
freightRateSchema.index({ companyId: 1, isActive: 1 });

module.exports = model('FreightRate', freightRateSchema);
