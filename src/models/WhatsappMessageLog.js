const { Schema, model } = require('mongoose');

/**
 * WhatsappMessageLog — every WhatsApp send ATTEMPT for a company, whether
 * it actually went out or not. Written unconditionally by
 * whatsappService.sendMessage/sendDocument (including the "not configured"
 * no-op outcome) so a vendor can look at one screen (WhatsappLogPage) and
 * tell whether their integration is actually working, the same reason
 * ReviewRequest/webhook deliveries keep their own trail elsewhere in this
 * app rather than relying on server logs nobody but us can see.
 */
const whatsappMessageLogSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  to: { type: String, required: true }, // destination phone number, E.164-ish as entered
  type: { type: String, enum: ['order_confirmation', 'payment_reminder', 'other'], default: 'other' },
  status: { type: String, enum: ['sent', 'failed', 'not_configured'], required: true },
  // What was actually sent — template name + params for a template send, or
  // a short description for a document send — kept as free text since the
  // shapes differ (message vs document) and this is for display, not replay.
  detail: { type: String, default: '' },
  errorMessage: { type: String, default: null },
  sentAt: { type: Date, default: Date.now },
}, { timestamps: true });

whatsappMessageLogSchema.index({ companyId: 1, createdAt: -1 });
// Payment-reminder idempotency: "has this customer already gotten a
// reminder today" is answered by querying this log (type + to + sentAt
// within the day) rather than a separate dedupe table — see
// paymentReminderCron.js.
whatsappMessageLogSchema.index({ companyId: 1, type: 1, to: 1, sentAt: -1 });

module.exports = model('WhatsappMessageLog', whatsappMessageLogSchema);
