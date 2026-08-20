const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/schoolController');

router.use(requireAuth, scopeToCompany);

router.use(requireActiveModule('school'));

router.get('/students', controller.listStudents); // ?className=
router.post('/students', body('name').isString().trim().notEmpty().withMessage('Name is required.'), validate, controller.createStudent);

router.get('/fee-structures', controller.listFeeStructures);
router.post('/fee-structures',
  body('name').isString().notEmpty().withMessage('name is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required — must be a Product with trackingMode "service".'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  validate, controller.createFeeStructure);

router.post('/fee-invoices/generate',
  body('feeStructureId').isString().notEmpty().withMessage('feeStructureId is required.'),
  body('period').isString().notEmpty().withMessage('period is required (e.g. "2026-08").'),
  body('dueDate').isISO8601().withMessage('dueDate must be a valid date.'),
  validate, controller.generateInvoices);
router.get('/fee-invoices', controller.listInvoices); // ?studentId=&status=&period=
router.post('/fee-invoices/flag-overdue', controller.flagOverdue);
router.post('/fee-invoices/:id/pay',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.payInvoice);

router.post('/attendance', controller.markAttendance);
router.get('/attendance/:studentId', controller.attendanceForMonth); // ?month=&year=

module.exports = router;
