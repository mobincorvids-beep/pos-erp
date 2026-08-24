const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/unitController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('shortCode').isString().trim().notEmpty().withMessage('shortCode is required.'),
  validate, controller.createUnit);
router.get('/', controller.listUnits);
router.put('/:id', controller.updateUnit);
router.delete('/:id', controller.deleteUnit);

module.exports = router;
