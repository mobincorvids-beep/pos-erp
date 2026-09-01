const { Schema, model } = require('mongoose');

// OKR-style goal. parentGoalId enables company -> team -> individual
// cascading (a company goal can have team goals under it, which can have
// individual goals under those) without needing separate models per level.
const goalSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  parentGoalId: { type: Schema.Types.ObjectId, ref: 'Goal', default: null },

  title: { type: String, required: true },
  description: String,
  category: { type: String, enum: ['individual', 'team', 'company'], default: 'individual' },

  targetValue: { type: Number, default: 0 },
  currentValue: { type: Number, default: 0 },
  unit: { type: String, default: '' }, // e.g. "%", "units", "$" — plain text, not enforced

  dueDate: Date,
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'at_risk', 'completed', 'cancelled'],
    default: 'not_started',
  },
}, { timestamps: true });

module.exports = model('Goal', goalSchema);
