const { Schema, model } = require('mongoose');

const pickWaveSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  waveNumber: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'picking', 'completed', 'cancelled'], default: 'pending' },
  saleIds: [{ type: Schema.Types.ObjectId, ref: 'Sale' }],
  assignedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = model('PickWave', pickWaveSchema);
