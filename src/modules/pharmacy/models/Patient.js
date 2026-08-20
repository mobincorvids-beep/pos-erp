const { Schema, model } = require('mongoose');

// Kept separate from the core Customer collection deliberately — a walk-in
// pharmacy customer is a Customer (for ledger/credit), but a Patient carries
// medical history that has no business living in the core schema.
const patientSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' }, // linked if they also have an account/credit
  name: { type: String, required: true },
  age: Number,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  phone: String,
  allergies: [{ type: String }],
  chronicConditions: [{ type: String }],
}, { timestamps: true });

module.exports = model('Patient', patientSchema);
