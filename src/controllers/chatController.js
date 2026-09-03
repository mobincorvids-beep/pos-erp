const chatService = require('../services/chatService');
const { CHAT_ATTACHMENT_MAX_FILE_BYTES } = require('../models/ChatMessage');

// Same inline base64 validation Document.js/documentController's
// validateFile already established, generalized to an array since a chat
// message can carry more than one attachment.
function validateAttachments(attachments) {
  if (attachments === undefined || attachments === null) return null;
  if (!Array.isArray(attachments)) return 'attachments must be an array.';
  for (const a of attachments) {
    if (!a || typeof a !== 'object') return 'Each attachment must be an object.';
    if (!a.fileName || typeof a.fileName !== 'string' || !a.fileName.trim()) return 'Each attachment needs a fileName.';
    if (!a.fileData || typeof a.fileData !== 'string' || !/^data:[^;]+;base64,/.test(a.fileData)) {
      return 'Each attachment\'s fileData must be a base64 data URI (e.g. "data:application/pdf;base64,...").';
    }
    const base64 = a.fileData.slice(a.fileData.indexOf(',') + 1);
    const approxBytes = Math.floor(base64.length * 0.75);
    if (approxBytes > CHAT_ATTACHMENT_MAX_FILE_BYTES) {
      return `Attachment "${a.fileName}" is too large: ${(approxBytes / (1024 * 1024)).toFixed(1)}MB exceeds the ${CHAT_ATTACHMENT_MAX_FILE_BYTES / (1024 * 1024)}MB limit.`;
    }
  }
  return null;
}

function enrichAttachments(attachments) {
  if (!Array.isArray(attachments)) return attachments;
  return attachments.map((a) => {
    const out = { ...a };
    if (!out.mimeType) {
      const match = /^data:([^;]+);base64,/.exec(out.fileData);
      if (match) out.mimeType = match[1];
    }
    if (out.fileSizeBytes == null) {
      const base64 = out.fileData.slice(out.fileData.indexOf(',') + 1);
      out.fileSizeBytes = Math.floor(base64.length * 0.75);
    }
    return out;
  });
}

async function createChannel(req, res) {
  try {
    const channel = await chatService.createChannel({ ...req.body, companyId: req.companyId, createdBy: req.auth.userId });
    res.status(201).json(channel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function openDirectMessage(req, res) {
  try {
    const channel = await chatService.openDirectMessage({ companyId: req.companyId, userId: req.auth.userId, otherUserId: req.body.otherUserId });
    res.status(201).json(channel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listChannels(req, res) {
  const channels = await chatService.listChannelsForUser(req.companyId, req.auth.userId);
  res.json(channels);
}

async function listMessages(req, res) {
  const messages = await chatService.listMessages(req.params.channelId, { before: req.query.before, limit: req.query.limit ? Number(req.query.limit) : undefined });
  res.json(messages);
}

async function listThreadReplies(req, res) {
  const replies = await chatService.listThreadReplies(req.params.messageId);
  res.json(replies);
}

async function sendMessage(req, res) {
  try {
    const attachmentError = validateAttachments(req.body.attachments);
    if (attachmentError) return res.status(400).json({ error: attachmentError });
    const body = { ...req.body };
    if (body.attachments) body.attachments = enrichAttachments(body.attachments);
    const message = await chatService.sendMessage({ ...body, companyId: req.companyId, channelId: req.params.channelId, senderId: req.auth.userId });
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function editMessage(req, res) {
  try { res.json(await chatService.editMessage(req.params.messageId, { text: req.body.text, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function deleteMessage(req, res) {
  try { res.json(await chatService.deleteMessage(req.params.messageId, req.auth.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function pinMessage(req, res) {
  try { res.json(await chatService.setPinned(req.params.messageId, true)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function unpinMessage(req, res) {
  try { res.json(await chatService.setPinned(req.params.messageId, false)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function listPinned(req, res) {
  res.json(await chatService.listPinned(req.params.channelId));
}

async function markChannelRead(req, res) {
  res.json(await chatService.markChannelRead(req.companyId, req.params.channelId, req.auth.userId));
}

async function addMember(req, res) {
  try { res.json(await chatService.addMember(req.params.channelId, req.body.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function removeMember(req, res) {
  try { res.json(await chatService.removeMember(req.params.channelId, req.body.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function toggleReaction(req, res) {
  try { res.json(await chatService.toggleReaction(req.params.messageId, { emoji: req.body.emoji, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function searchMessages(req, res) {
  try { res.json(await chatService.searchMessages(req.companyId, req.auth.userId, req.query.q, { limit: req.query.limit ? Number(req.query.limit) : undefined })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = {
  createChannel, openDirectMessage, listChannels,
  listMessages, listThreadReplies, sendMessage, editMessage, deleteMessage,
  pinMessage, unpinMessage, listPinned, markChannelRead, addMember, removeMember,
  toggleReaction, searchMessages,
};
