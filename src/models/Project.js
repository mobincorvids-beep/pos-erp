const { Schema, model } = require('mongoose');

const projectSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  budget: { type: Number, default: 0 },
  status: { type: String, default: 'planned', enum: ['planned', 'in_progress', 'completed', 'cancelled'] },
  managerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  startDate: Date,
  endDate: Date,
}, { timestamps: true });

module.exports = model('Project', projectSchema);
