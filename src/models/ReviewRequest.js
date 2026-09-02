const { Schema, model } = require('mongoose');
const crypto = require('crypto');

// Lightweight "reputation management" record — send a customer a link
// after a sale (or ad hoc) asking them to rate their experience. This is
// intentionally NOT a real Google/Facebook review posting integration:
// there is no OAuth flow or Business Profile API call here (that needs
// real third-party API credentials this sandbox doesn't have) — a
// rating >= 4 just flips `sharedPublicly` so the vendor's own dashboard
// can show "customers happy to be quoted", nothing is actually posted
// anywhere external. A rating < 4 flips `needsFollowUp` for an internal
// dashboard list instead.
const reviewRequestSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // optional — "review this specific purchase"
  status: { type: String, enum: ['pending', 'sent', 'responded'], default: 'pending' },
  sentAt: { type: Date, default: null },
  respondedAt: { type: Date, default: null },
  rating: { type: Number, min: 1, max: 5, default: null },
  feedback: { type: String, default: '' },
  // Random opaque token — the public review page is reached at
  // /review/:token with no login, same "token instead of a JWT" pattern
  // as the public funnel submission routes.
  publicReviewLink: { type: String, required: true, unique: true, default: () => crypto.randomBytes(24).toString('hex') },
  sharedPublicly: { type: Boolean, default: false }, // customer opted in to a >=4 rating being shown/quoted — no real external posting happens
  needsFollowUp: { type: Boolean, default: false }, // set automatically when rating < 4
}, { timestamps: true });

reviewRequestSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = model('ReviewRequest', reviewRequestSchema);
