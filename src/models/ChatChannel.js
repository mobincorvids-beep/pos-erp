const { Schema, model } = require('mongoose');

// A channel is either a real named group ('channel') or exactly two
// members with no name ('dm') — modeling DMs as a channel with type
// 'dm' rather than a separate collection means messages, unread
// tracking, and pinning all work identically for both without
// duplicating that logic.
const chatChannelSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  type: { type: String, enum: ['channel', 'dm'], required: true },
  name: { type: String, default: null }, // required for type 'channel', null for 'dm' (rendered client-side from the other member's name)
  isPrivate: { type: Boolean, default: false }, // only relevant for type 'channel' — a 'dm' is always private by nature
  purpose: { type: String, default: '' },
  memberIds: { type: [Schema.Types.ObjectId], ref: 'User', required: true },
  // Deterministic, sorted-and-joined pair of user ids — set by
  // chatService only for type 'dm', so the unique index below can catch
  // "these two users already have a DM channel" with a single indexed
  // lookup instead of an array-containment scan on every send.
  dmKey: { type: String, default: null },
  // Optional tie-in to any other record in the app (a Project, a Sale, a
  // CRM Opportunity) — lets a channel be spun up "about" something
  // specific, per the spec's "related module/record" field, without this
  // model needing to know what that thing is.
  relatedModule: { type: String, default: null },
  relatedRecordId: { type: Schema.Types.ObjectId, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

chatChannelSchema.index({ companyId: 1, memberIds: 1 });
chatChannelSchema.index({ companyId: 1, dmKey: 1 }, { unique: true, partialFilterExpression: { type: 'dm' } });

module.exports = model('ChatChannel', chatChannelSchema);
