const { Schema, model } = require('mongoose');

// A REAL core Helpdesk — universal, not scoped to one industry. Housing
// Society's SocietyComplaint proved the "submit -> assign -> resolve"
// shape works, but it's tied to residents and properties specifically.
// This is that same proven shape, generalized so ANY company (a retail
// shop, a hospital, a courier firm) can turn it on for customer or
// internal support — and it adds the real piece Housing Society's
// version never needed: a genuine, time-based SLA with breach detection,
// not just a status workflow.
const ticketSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null }, // null for an internal/staff ticket
  raisedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // set for an internal ticket instead
  category: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, required: true, enum: ['low', 'medium', 'high', 'emergency'] },
  status: { type: String, default: 'open', enum: ['open', 'assigned', 'resolved', 'closed'] },
  assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  // The real SLA mechanic — slaDueAt is computed once, at creation, from
  // the priority's own response-time target, and is never recomputed
  // later even if priority changes, the same "snapshot the terms at the
  // moment that matters" convention this app already uses for prices and
  // exchange rates elsewhere.
  slaDueAt: { type: Date, required: true },
  firstRespondedAt: { type: Date, default: null }, // set the moment a ticket is actually assigned — the real "response" event this SLA measures against
  slaBreached: { type: Boolean, default: null }, // null until responded to; then a real, permanent record of whether the target was met

  resolutionNote: String,
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = model('Ticket', ticketSchema);
