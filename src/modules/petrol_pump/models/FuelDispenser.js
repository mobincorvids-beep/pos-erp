const { Schema, model } = require('mongoose');

// A physical pump nozzle — its meter reading only ever counts UP, for the
// life of the machine, never resetting to zero on a sale (that's how real
// fuel dispensers work). The genuinely new mechanic this module exists
// for: a sale's quantity is never entered directly by anyone — it's
// DERIVED as (closingReading - openingReading) for one shift, the only
// module in this app where the sold quantity is a subtraction between two
// readings rather than a number someone typed in or a stock level someone tracked.
const fuelDispenserSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  name: { type: String, required: true }, // "Pump 1 - Nozzle A"
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // the fuel grade — Petrol, Diesel...
  variantId: { type: Schema.Types.ObjectId, required: true },
  currentMeterReading: { type: Number, default: 0 }, // the lifetime cumulative total, in litres
}, { timestamps: true });

module.exports = model('FuelDispenser', fuelDispenserSchema);
