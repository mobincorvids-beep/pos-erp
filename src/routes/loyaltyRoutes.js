const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { LOYALTY_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/loyaltyController');

router.use(requireAuth, scopeToCompany);
router.get('/program', controller.getProgram);
router.put('/program', requirePermission(LOYALTY_MANAGE),
  body('earnRate').isFloat({ min: 0 }).withMessage('earnRate must be a non-negative number.'),
  body('redemptionValue').isFloat({ min: 0 }).withMessage('redemptionValue must be a non-negative number.'),
  body('minRedeemPoints').isFloat({ min: 0 }).withMessage('minRedeemPoints must be a non-negative number.'),
  body('isActive').isBoolean().withMessage('isActive must be true or false.'),
  validate, controller.upsertProgram);

// Redemption is part of the normal checkout flow (a cashier applying a
// customer's points as a discount), not a configuration action — left open
// to any authenticated staff member, same as pos.sell isn't required here either.
router.post('/customers/:customerId/redeem', body('points').isFloat({ gt: 0 }).withMessage('points must be greater than zero.'), validate, controller.redeem);
router.post('/customers/:customerId/reverse', body('points').isFloat({ gt: 0 }).withMessage('points must be greater than zero.'), validate, controller.reverseRedemption);
router.get('/customers/:customerId/history', controller.history);

module.exports = router;
