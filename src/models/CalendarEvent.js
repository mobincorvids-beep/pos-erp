const { Schema, model } = require('mongoose');

// Deliberately separate from Appointment — Appointment is a
// customer-facing, billable booking (Salon/Gym/Clinic), tied to a
// customer and a sellable service. This is the internal-team calendar
// the spec calls for: staff meeting with staff, no customer, no billing,
// optionally tied to ANY other record in the app (a Project milestone
// review, a CRM deal call) via relatedModule/relatedRecordId — the same
// loose tie-in pattern ChatChannel uses.
const calendarEventSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  attendeeResponses: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    response: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  }],
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  allDay: { type: Boolean, default: false },
  location: { type: String, default: '' },
  meetingUrl: { type: String, default: '' },
  relatedModule: { type: String, default: null },
  relatedRecordId: { type: Schema.Types.ObjectId, default: null },
  status: { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled' },
}, { timestamps: true });

calendarEventSchema.index({ companyId: 1, organizerId: 1, startTime: 1 });
calendarEventSchema.index({ companyId: 1, 'attendeeResponses.userId': 1, startTime: 1 });

module.exports = model('CalendarEvent', calendarEventSchema);
