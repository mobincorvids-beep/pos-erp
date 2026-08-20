const { Schema, model } = require('mongoose');

// A single physical roll of fabric/leather — the genuinely new mechanic
// this module exists for: every prior module deals in whole, discrete
// units (a room, a visit, a pair of shoes, a croissant). A roll is a
// CONTINUOUS quantity that shrinks as fabric is cut from it, and its
// remainingLength has to automatically flip its own status once it drops
// below a usable threshold — the inverse of Service Station's mileage
// (which counts UP toward a threshold); this counts DOWN from a starting
// length toward zero, and "remnant" is what happens when it gets too
// short to sell as a full roll but isn't empty yet.
const fabricRollSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  rollNumber: { type: String, required: true },
  unitOfMeasure: { type: String, default: 'meters', enum: ['meters', 'yards'] },
  originalLength: { type: Number, required: true },
  remainingLength: { type: Number, required: true },
  remnantThreshold: { type: Number, default: 5 }, // below this remaining length, the roll auto-flags as a remnant
  status: { type: String, default: 'active', enum: ['active', 'remnant', 'exhausted'] },
}, { timestamps: true });

fabricRollSchema.index({ companyId: 1, rollNumber: 1 }, { unique: true });

module.exports = model('FabricRoll', fabricRollSchema);
