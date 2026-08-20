const { Schema, model } = require('mongoose');

// One shift's readings on one dispenser — opening reading captured at
// shift start, closing reading at shift end, and the actual litres sold
// is nothing more than their difference. There's no "enter how much fuel
// you sold" step anywhere — the meter itself is the ledger.
const fuelShiftSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  dispenserId: { type: Schema.Types.ObjectId, ref: 'FuelDispenser', required: true, index: true },
  openingReading: { type: Number, required: true },
  closingReading: { type: Number, default: null },
  litresSold: { type: Number, default: null },
  pricePerLitre: { type: Number, required: true }, // snapshotted at shift start — a mid-shift price change never retroactively alters an already-open shift's rate
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  status: { type: String, default: 'open', enum: ['open', 'closed'] },
}, { timestamps: true });

module.exports = model('FuelShift', fuelShiftSchema);
