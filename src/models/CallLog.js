const { Schema, model } = require('mongoose');

// Manual call-logging only — "click Log a call and fill in notes". This
// is NOT a real telephony/click-to-call integration: there is no Twilio
// Voice wiring here (that needs a real Twilio Voice number + webhook this
// sandbox can't set up or test), so there is no actual dialing, no call
// recording, and durationSeconds is whatever the staff member types in
// after the fact, not measured by anything.
const callLogSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  phoneNumber: { type: String, default: '' },
  direction: { type: String, enum: ['inbound', 'outbound'], default: 'outbound' },
  notedAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  durationSeconds: { type: Number, default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // who logged it
}, { timestamps: true });

callLogSchema.index({ companyId: 1, customerId: 1, notedAt: -1 });

module.exports = model('CallLog', callLogSchema);
