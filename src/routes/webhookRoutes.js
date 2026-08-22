const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ROLES_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/webhookController');

router.use(requireAuth, scopeToCompany, requirePermission(ROLES_MANAGE)); // subscribing a URL to receive company events is an admin-level action, same permission tier as managing roles

router.post('/', body('eventType').isString().trim().notEmpty().withMessage('eventType is required.'), body('targetUrl').isURL().withMessage('targetUrl must be a valid URL.'), validate, controller.subscribe);
router.get('/', controller.listSubscriptions);
router.post('/:id/unsubscribe', controller.unsubscribe);

module.exports = router;
