const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/chatController');

router.use(requireAuth, scopeToCompany);

router.get('/channels', controller.listChannels);
router.post('/channels',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  validate, controller.createChannel);
router.post('/channels/dm',
  body('otherUserId').isString().notEmpty().withMessage('otherUserId is required.'),
  validate, controller.openDirectMessage);

router.get('/channels/:channelId/messages', controller.listMessages); // ?before=&limit=
router.post('/channels/:channelId/messages',
  body('text').isString().trim().notEmpty().withMessage('text is required.'),
  validate, controller.sendMessage);
router.post('/channels/:channelId/read', controller.markChannelRead);
router.get('/channels/:channelId/pinned', controller.listPinned);
router.post('/channels/:channelId/members', body('userId').isString().notEmpty().withMessage('userId is required.'), validate, controller.addMember);
router.delete('/channels/:channelId/members', body('userId').isString().notEmpty().withMessage('userId is required.'), validate, controller.removeMember);

router.get('/messages/:messageId/thread', controller.listThreadReplies);
router.put('/messages/:messageId', body('text').isString().trim().notEmpty().withMessage('text is required.'), validate, controller.editMessage);
router.delete('/messages/:messageId', controller.deleteMessage);
router.post('/messages/:messageId/pin', controller.pinMessage);
router.post('/messages/:messageId/unpin', controller.unpinMessage);

module.exports = router;
