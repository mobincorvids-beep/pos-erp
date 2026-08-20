const { Schema, model } = require('mongoose');

const customerFollowUpSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  dueDate: { type: Date, required: true },
  note: { type: String, required: true }, // "Call about renewal", "Check if product arrived undamaged"
  assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'pending', enum: ['pending', 'done', 'cancelled'] },
  completedAt: Date,
  completionNote: String,
}, { timestamps: true });

customerFollowUpSchema.index({ companyId: 1, status: 1, dueDate: 1 });

module.exports = model('CustomerFollowUp', customerFollowUpSchema);
