const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/callLogController');

// Manual call log — simple CRUD, no telephony integration (see model
// comment). Mounted at /call-logs (see src/routes/index.js).
router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?customerId=
router.post('/',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('direction').optional().isIn(['inbound', 'outbound']),
  validate, controller.create);
router.delete('/:id', controller.remove);

module.exports = router;
