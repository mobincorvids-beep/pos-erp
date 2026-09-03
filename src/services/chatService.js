/**
 * ChatService — internal team communication (Slack-class), native to
 * this app's own records rather than a bolted-on third-party widget.
 * Channels are either a real named group or a 1:1 DM (see ChatChannel);
 * messages support replies (threads), @mentions, pinning, and edit/soft-
 * delete. Unread counts are computed from a per-(channel,user)
 * "last read up to" marker rather than a per-message read flag — see
 * ChatChannelRead for why.
 */
const ChatChannel = require('../models/ChatChannel');
const ChatMessage = require('../models/ChatMessage');
const ChatChannelRead = require('../models/ChatChannelRead');
const notificationService = require('./notificationService');

function dmKeyFor(userIdA, userIdB) {
  return [String(userIdA), String(userIdB)].sort().join(':');
}

/** Creates a real named channel. */
async function createChannel({ companyId, name, isPrivate, purpose, memberIds, relatedModule, relatedRecordId, createdBy }) {
  if (!name || !name.trim()) throw new Error('Channel name is required.');
  const uniqueMembers = [...new Set([...(memberIds || []).map(String), String(createdBy)])];
  return ChatChannel.create({
    companyId, type: 'channel', name: name.trim(), isPrivate: !!isPrivate, purpose: purpose || '',
    memberIds: uniqueMembers, relatedModule: relatedModule || null, relatedRecordId: relatedRecordId || null, createdBy,
  });
}

/** Opens (or reuses) a 1:1 DM channel between two users, findOneAndUpdate with upsert on the unique dmKey index makes "get or create" a single atomic call, so two people opening a DM with each other at the same moment can't create two separate channels. */
async function openDirectMessage({ companyId, userId, otherUserId }) {
  if (String(userId) === String(otherUserId)) throw new Error('Cannot open a DM with yourself.');
  const dmKey = dmKeyFor(userId, otherUserId);
  return ChatChannel.findOneAndUpdate(
    { companyId, type: 'dm', dmKey },
    { $setOnInsert: { companyId, type: 'dm', dmKey, memberIds: [userId, otherUserId], createdBy: userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/** Every channel/DM a user is a member of, most recently active first, with each one's unread count attached. */
async function listChannelsForUser(companyId, userId) {
  const channels = await ChatChannel.find({ companyId, memberIds: userId, archivedAt: null })
    .populate('memberIds', 'name')
    .sort({ updatedAt: -1 });

  const reads = await ChatChannelRead.find({ companyId, userId, channelId: { $in: channels.map((c) => c._id) } });
  const lastReadByChannel = new Map(reads.map((r) => [String(r.channelId), r.lastReadAt]));

  return Promise.all(channels.map(async (channel) => {
    const lastReadAt = lastReadByChannel.get(String(channel._id)) || new Date(0);
    const unreadCount = await ChatMessage.countDocuments({ channelId: channel._id, createdAt: { $gt: lastReadAt }, deletedAt: null, senderId: { $ne: userId } });
    return { ...channel.toObject(), unreadCount };
  }));
}

/** Root messages in a channel (not thread replies), newest-first page, oldest-first once returned, the conventional way a chat view loads history. */
async function listMessages(channelId, { before, limit = 50 } = {}) {
  const filter = { channelId, replyToMessageId: null };
  if (before) filter.createdAt = { $lt: new Date(before) };
  const messages = await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(limit).populate('senderId', 'name');
  return messages.reverse();
}

/** All replies in one thread, oldest-first. */
function listThreadReplies(rootMessageId) {
  return ChatMessage.find({ replyToMessageId: rootMessageId }).sort({ createdAt: 1 }).populate('senderId', 'name');
}

/** Extracts @mentioned user ids from message text by matching against the channel's own member list: deliberately scoped to actual members rather than a free-text username parse, so a mention can never silently target someone who isn't even in the channel. */
async function resolveMentions(channel, text) {
  const User = require('../models/User');
  const members = await User.find({ _id: { $in: channel.memberIds } }, 'name');
  return members.filter((m) => text.includes(`@${m.name}`)).map((m) => m._id);
}

/** Posts a message. Mentioned members get a real in-app notification, same channel every other automated alert in this app uses, a mention isn't a second-class event. */
async function sendMessage({ companyId, channelId, senderId, text, replyToMessageId, attachmentUrls, attachments }) {
  if (!text || !text.trim()) throw new Error('Message text is required.');
  const channel = await ChatChannel.findOne({ _id: channelId, companyId });
  if (!channel) throw new Error('Channel not found.');
  if (!channel.memberIds.some((id) => String(id) === String(senderId))) throw new Error('You are not a member of this channel.');

  if (replyToMessageId) {
    const root = await ChatMessage.findOne({ _id: replyToMessageId, channelId });
    if (!root) throw new Error('The message being replied to was not found in this channel.');
  }

  const mentionedUserIds = await resolveMentions(channel, text);
  const message = await ChatMessage.create({
    companyId, channelId, senderId, text: text.trim(), mentionedUserIds,
    replyToMessageId: replyToMessageId || null, attachmentUrls: attachmentUrls || [],
    attachments: attachments || [],
  });

  channel.updatedAt = new Date();
  await channel.save();

  if (mentionedUserIds.length) {
    const User = require('../models/User');
    const sender = await User.findById(senderId, 'name');
    const channelLabel = channel.type === 'channel' ? `#${channel.name}` : 'a direct message';
    for (const userId of mentionedUserIds) {
      if (String(userId) === String(senderId)) continue;
      await notificationService.notify({
        companyId, userId, type: 'chat_mention',
        title: `You were mentioned in ${channelLabel}`,
        message: `${sender?.name || 'Someone'}: ${text.slice(0, 140)}`,
        entityType: 'ChatChannel', entityId: channel._id,
      });
    }
  }

  return ChatMessage.findById(message._id).populate('senderId', 'name');
}

/** Edits a message: only the original sender may edit their own message. */
async function editMessage(messageId, { text, userId }) {
  const message = await ChatMessage.findById(messageId);
  if (!message || message.deletedAt) throw new Error('Message not found.');
  if (String(message.senderId) !== String(userId)) throw new Error('You can only edit your own messages.');
  if (!text || !text.trim()) throw new Error('Message text is required.');
  message.text = text.trim();
  message.editedAt = new Date();
  await message.save();
  return message;
}

/** Soft-deletes a message: text is cleared but the row stays (with deletedAt set) so any replies in its thread keep a valid, if now-empty, parent instead of pointing at nothing. */
async function deleteMessage(messageId, userId) {
  const message = await ChatMessage.findById(messageId);
  if (!message || message.deletedAt) throw new Error('Message not found.');
  if (String(message.senderId) !== String(userId)) throw new Error('You can only delete your own messages.');
  message.deletedAt = new Date();
  message.text = '[deleted]';
  await message.save();
  return message;
}

/** Toggles the current user's reaction with a given emoji on a message: adds it if not already present, removes it if it is — a single idempotent call either way, same as Slack's reaction click. */
async function toggleReaction(messageId, { emoji, userId }) {
  if (!emoji || !emoji.trim()) throw new Error('An emoji is required.');
  const message = await ChatMessage.findById(messageId);
  if (!message || message.deletedAt) throw new Error('Message not found.');

  const row = message.reactions.find((r) => r.emoji === emoji);
  if (row) {
    const already = row.userIds.some((id) => String(id) === String(userId));
    if (already) {
      row.userIds = row.userIds.filter((id) => String(id) !== String(userId));
      if (row.userIds.length === 0) {
        message.reactions = message.reactions.filter((r) => r !== row);
      }
    } else {
      row.userIds.push(userId);
    }
  } else {
    message.reactions.push({ emoji, userIds: [userId] });
  }
  await message.save();
  return ChatMessage.findById(message._id).populate('senderId', 'name');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive regex search across message text, scoped to channels the searching user is actually a member of (same regex-search pattern knowledgeBaseService already uses, rather than a $text index). */
async function searchMessages(companyId, userId, q, { limit = 50 } = {}) {
  if (!q || !q.trim()) return [];
  const memberChannels = await ChatChannel.find({ companyId, memberIds: userId, archivedAt: null }, '_id name type');
  const channelIds = memberChannels.map((c) => c._id);
  const channelById = new Map(memberChannels.map((c) => [String(c._id), c]));

  const re = new RegExp(escapeRegex(q.trim()), 'i');
  const messages = await ChatMessage.find({
    companyId, channelId: { $in: channelIds }, deletedAt: null, text: re,
  }).sort({ createdAt: -1 }).limit(limit).populate('senderId', 'name');

  return messages.map((m) => ({ ...m.toObject(), channel: channelById.get(String(m.channelId)) || null }));
}

function setPinned(messageId, pinned) {
  return ChatMessage.findByIdAndUpdate(messageId, { pinned: !!pinned }, { new: true });
}

function listPinned(channelId) {
  return ChatMessage.find({ channelId, pinned: true, deletedAt: null }).sort({ createdAt: -1 }).populate('senderId', 'name');
}

/** Marks a channel read up to now, the simple, standard "open the channel = read it" behavior most chat apps use, rather than per-message read receipts. */
function markChannelRead(companyId, channelId, userId) {
  return ChatChannelRead.findOneAndUpdate(
    { companyId, channelId, userId },
    { $set: { lastReadAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function addMember(channelId, userId) {
  const channel = await ChatChannel.findById(channelId);
  if (!channel) throw new Error('Channel not found.');
  if (channel.type === 'dm') throw new Error('Cannot add members to a DM, start a group channel instead.');
  if (!channel.memberIds.some((id) => String(id) === String(userId))) {
    channel.memberIds.push(userId);
    await channel.save();
  }
  return channel;
}

async function removeMember(channelId, userId) {
  const channel = await ChatChannel.findById(channelId);
  if (!channel) throw new Error('Channel not found.');
  if (channel.type === 'dm') throw new Error('Cannot remove members from a DM.');
  channel.memberIds = channel.memberIds.filter((id) => String(id) !== String(userId));
  await channel.save();
  return channel;
}

module.exports = {
  createChannel, openDirectMessage, listChannelsForUser,
  listMessages, listThreadReplies, sendMessage, editMessage, deleteMessage,
  setPinned, listPinned, markChannelRead, addMember, removeMember,
  toggleReaction, searchMessages,
};
