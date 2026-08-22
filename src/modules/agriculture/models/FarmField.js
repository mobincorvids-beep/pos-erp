const { Schema, model } = require('mongoose');

// A persistent location that accumulates history across many crop cycles
// season after season — the genuinely new concept this module exists
// for. A Manufacturing WorkOrder has no equivalent: it's a one-off
// production run with no shared "place" that remembers how every past
// run at that same place actually performed, which is exactly what a
// real farm needs (a field's own yield history, to know if THIS season's
// harvest is unusually good or bad for THAT specific field).
const farmFieldSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  name: { type: String, required: true }, // "North Field"
  areaAcres: { type: Number, required: true },
}, { timestamps: true });

module.exports = model('FarmField', farmFieldSchema);
