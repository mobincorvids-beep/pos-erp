const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const patientController = require('../controllers/patientController');
const prescriptionController = require('../controllers/prescriptionController');
const doctorController = require('../controllers/doctorController');

router.use(requireAuth, scopeToCompany);

router.use(requireActiveModule('pharmacy'));

router.get('/patients', patientController.list);
router.post('/patients', patientController.create);
router.put('/patients/:id', patientController.update);

// Doctors — was entirely missing (model existed, nothing used it).
router.get('/doctors', doctorController.list);
router.post('/doctors', doctorController.create);
router.put('/doctors/:id', doctorController.update);
router.delete('/doctors/:id', doctorController.remove);

router.get('/prescriptions', prescriptionController.list);
router.post('/prescriptions', prescriptionController.create);
router.put('/prescriptions/:id', prescriptionController.update);
router.delete('/prescriptions/:id', prescriptionController.cancel);
router.post('/prescriptions/:id/dispense', prescriptionController.dispense);

router.get('/reports/near-expiry', prescriptionController.nearExpiry); // ?days=30

module.exports = router;
