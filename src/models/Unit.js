const { Schema, model } = require('mongoose');

const unitSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },       // Piece, Kg, Litre, Dozen
  shortCode: { type: String, required: true },   // pc, kg, ltr, dz
  baseUnitId: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
  conversionFactor: { type: Number, default: 1 }, // relative to baseUnit
}, { timestamps: true });

module.exports = model('Unit', unitSchema);
