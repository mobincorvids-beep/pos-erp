const chatService = require('../services/chatService');

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
    const message = await chatService.sendMessage({ ...req.body, companyId: req.companyId, channelId: req.params.channelId, senderId: req.auth.userId });
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

module.exports = {
  createChannel, openDirectMessage, listChannels,
  listMessages, listThreadReplies, sendMessage, editMessage, deleteMessage,
  pinMessage, unpinMessage, listPinned, markChannelRead, addMember, removeMember,
};
