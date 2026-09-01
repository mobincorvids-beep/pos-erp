const { Schema, model } = require('mongoose');

const pickWaveLineSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  pickWaveId: { type: Schema.Types.ObjectId, ref: 'PickWave', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  binId: { type: Schema.Types.ObjectId, ref: 'WarehouseBin', required: true },
  quantityToPick: { type: Number, required: true },
  quantityPicked: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'picked'], default: 'pending' },
}, { timestamps: true });

module.exports = model('PickWaveLine', pickWaveLineSchema);
