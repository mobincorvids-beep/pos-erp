const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const patientController = require('../controllers/patientController');
const prescriptionController = require('../controllers/prescriptionController');

router.use(requireAuth, scopeToCompany);

router.use(requireActiveModule('pharmacy'));

router.get('/patients', patientController.list);
router.post('/patients', patientController.create);

router.get('/prescriptions', prescriptionController.list);
router.post('/prescriptions', prescriptionController.create);
router.post('/prescriptions/:id/dispense', prescriptionController.dispense);

router.get('/reports/near-expiry', prescriptionController.nearExpiry); // ?days=30

module.exports = router;
