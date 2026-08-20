const { Schema, model } = require('mongoose');

const customerFeedbackSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // optional link to a specific visit/order
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  category: { type: String, default: 'general' }, // general, complaint, compliment, suggestion
  status: { type: String, default: 'open', enum: ['open', 'acknowledged', 'resolved'] },
  resolutionNote: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // who logged it (if staff-entered)
}, { timestamps: true });

module.exports = model('CustomerFeedback', customerFeedbackSchema);
