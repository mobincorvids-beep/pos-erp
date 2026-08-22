const { Schema, model } = require('mongoose');

// A bookable facility — a tennis court, a squash court, a football pitch.
const sportsFacilitySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  name: { type: String, required: true }, // "Court 1"
  hourlyRate: { type: Number, required: true },
}, { timestamps: true });

module.exports = model('SportsFacility', sportsFacilitySchema);
