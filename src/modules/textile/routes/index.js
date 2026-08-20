const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/fabricRollController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('textile'));

router.post('/rolls',
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('rollNumber').isString().trim().notEmpty().withMessage('rollNumber is required.'),
  body('length').isFloat({ gt: 0 }).withMessage('length must be greater than zero.'),
  validate, controller.receiveRoll);
router.get('/rolls', controller.listRolls); // ?status=&productId=
router.post('/rolls/:id/cut', body('lengthToCut').isFloat({ gt: 0 }).withMessage('lengthToCut must be greater than zero.'), validate, controller.cutFromRoll);

module.exports = router;
