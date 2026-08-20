const { Schema, model } = require('mongoose');

// A batch SMS/email send targeted at customers matching one or more tags.
// Delivery goes through a real, pluggable provider (see
// services/messaging/) — a working console/log transport by default,
// real Twilio/SendGrid HTTP calls if those credentials are configured.
// successCount/failureCount are populated from the actual per-recipient
// result of that call, not assumed.
const campaignSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  channel: { type: String, required: true, enum: ['sms', 'email'] },
  message: { type: String, required: true },
  targetTags: [{ type: String }], // customers with ANY of these tags are recipients; empty = all customers
  status: { type: String, default: 'draft', enum: ['draft', 'sent'] },
  recipientCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  provider: String, // which transport actually handled this send — 'console', 'twilio', 'sendgrid'
  sentAt: Date,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('Campaign', campaignSchema);
