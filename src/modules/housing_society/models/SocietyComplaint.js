const { Schema, model } = require('mongoose');

// A real resident complaint / work-order — the same "submit, assign,
// resolve" shape a genuine helpdesk ticket needs, here scoped to a
// society's own residents and staff rather than a generic support queue.
const societyComplaintSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
  residentCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  category: { type: String, required: true }, // 'plumbing', 'electrical', 'security', 'other'
  description: { type: String, required: true },
  priority: { type: String, default: 'medium', enum: ['low', 'medium', 'high', 'emergency'] },
  status: { type: String, default: 'open', enum: ['open', 'assigned', 'resolved'] },
  assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  resolutionNote: String,
}, { timestamps: true });

module.exports = model('SocietyComplaint', societyComplaintSchema);
