const { Schema, model } = require('mongoose');

// A multi-step, delay-driven marketing automation ("drip campaign" /
// customer journey), distinct from the one-shot batch Campaign model
// (src/models/Campaign.js) — a Campaign sends one message to a tag-matched
// list right now; a MarketingJourney enrolls individual customers and
// walks each of them through an ordered sequence of send/wait steps over
// time, tracked per-customer via JourneyEnrollment.
const journeyStepSchema = new Schema({
  stepType: { type: String, required: true, enum: ['send_email', 'send_sms', 'wait'] },
  // Hours to wait AFTER the previous step completes before this step
  // fires. For the first step, this delays enrollment -> first send (0 =
  // immediate). For a 'wait' step, this IS the step (no send).
  delayHours: { type: Number, default: 0, min: 0 },
  // Only used for send_email/send_sms. Simple {{token}} interpolation,
  // see marketingJourneyService#interpolate — supports {{customerName}},
  // {{customerEmail}}, {{customerPhone}}, {{companyName}}.
  templateSubject: { type: String, default: '' }, // send_email only
  templateBody: { type: String, default: '' },
}, { _id: false });

const marketingJourneySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true },
  status: { type: String, default: 'draft', enum: ['draft', 'active', 'paused'] },
  trigger: {
    type: { type: String, required: true, enum: ['segment_entry', 'manual', 'date_based'], default: 'manual' },
    segmentId: { type: Schema.Types.ObjectId, ref: 'AudienceSegment', default: null },
    // date_based is accepted by the schema for forward-compatibility but
    // is NOT actually evaluated anywhere yet — see marketingJourneyService
    // header comment. Not built in this version.
  },
  steps: { type: [journeyStepSchema], default: [] },
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // who created it
}, { timestamps: true });

marketingJourneySchema.index({ companyId: 1, status: 1 });

module.exports = model('MarketingJourney', marketingJourneySchema);
