const { Schema, model } = require('mongoose');

// Inline base64 attachments, same pattern Document.js already established
// (see DOCUMENT_MAX_FILE_BYTES) — no separate file-storage infra in this
// app, so a chat attachment is just a data-URI capped at 10MB like any
// other inline file upload.
const CHAT_ATTACHMENT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, pre-base64

const attachmentSchema = new Schema({
  fileName: { type: String, required: true },
  fileData: { type: String, required: true }, // inline base64 data-URI, e.g. "data:application/pdf;base64,...."
  mimeType: { type: String, default: null },
  fileSizeBytes: { type: Number, default: null },
}, { _id: false });

// One row per distinct emoji used on a message — userIds is who reacted
// with that emoji, so toggling is "add/remove my id from this emoji's
// array", and a reaction whose userIds becomes empty is simply pruned.
const reactionSchema = new Schema({
  emoji: { type: String, required: true },
  userIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
}, { _id: false });

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
  attachments: { type: [attachmentSchema], default: [] },
  reactions: { type: [reactionSchema], default: [] },
  pinned: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null }, // soft delete — keeps the message's place in a thread/reply chain intact rather than leaving a dangling replyToMessageId
}, { timestamps: true });

chatMessageSchema.index({ channelId: 1, createdAt: -1 });
chatMessageSchema.index({ replyToMessageId: 1 });

module.exports = model('ChatMessage', chatMessageSchema);
module.exports.CHAT_ATTACHMENT_MAX_FILE_BYTES = CHAT_ATTACHMENT_MAX_FILE_BYTES;
