const { Schema, model } = require('mongoose');

// One row per (channel, user) — tracks where that user has read up to.
// Unread count for a channel is then a single cheap count of messages
// in that channel created after lastReadAt, rather than storing a
// read/unread flag per message per user (which would multiply message
// storage by member count for no real benefit here).
const chatChannelReadSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  channelId: { type: Schema.Types.ObjectId, ref: 'ChatChannel', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastReadAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

chatChannelReadSchema.index({ channelId: 1, userId: 1 }, { unique: true });

module.exports = model('ChatChannelRead', chatChannelReadSchema);
