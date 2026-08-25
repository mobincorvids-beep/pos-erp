const { Schema, model } = require('mongoose');

const chatMessageSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  channelId: { type: Schema.Types.ObjectId, ref: 'ChatChannel', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  mentionedUserIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  // A thread is just "this message replies to that one" — no separate
  // thread object needed; listMessages can filter to root messages only
  // (replyToMessageId: null) for the main channel view, and a thread
  // panel queries by replyToMessageId to get just that thread's replies.
  replyToMessageId: { type: Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
  attachmentUrls: { type: [String], default: [] },
  pinned: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null }, // soft delete — keeps the message's place in a thread/reply chain intact rather than leaving a dangling replyToMessageId
}, { timestamps: true });

chatMessageSchema.index({ channelId: 1, createdAt: -1 });
chatMessageSchema.index({ replyToMessageId: 1 });

module.exports = model('ChatMessage', chatMessageSchema);
