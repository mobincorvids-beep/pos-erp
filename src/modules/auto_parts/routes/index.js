const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/fitmentController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('auto_parts'));

router.get('/lookup', controller.findPartsForVehicle); // ?make=&model=&year= — "what fits my car"
router.get('/products/:productId/fitments', controller.listFitmentsForProduct); // reverse direction — "what does this part fit"

router.post('/fitments',
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('make').isString().trim().notEmpty().withMessage('make is required.'),
  body('model').isString().trim().notEmpty().withMessage('model is required.'),
  body('yearFrom').isInt({ min: 1900 }).withMessage('yearFrom must be a valid year.'),
  body('yearTo').isInt({ min: 1900 }).withMessage('yearTo must be a valid year.'),
  validate, controller.addFitment);
router.delete('/fitments/:id', controller.removeFitment);

module.exports = router;
