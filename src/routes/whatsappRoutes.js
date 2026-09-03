const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/whatsappController');

// Mounted at /whatsapp (see src/routes/index.js). Credentials themselves
// live on Company and are read/written via GET/PUT /org/company (see
// orgController, gated on roles.manage there) — this endpoint is
// read-only (the send-attempt log for WhatsappLogPage), so any
// authenticated staff member of the company can view it, same as
// review-requests' list endpoint.
router.use(requireAuth, scopeToCompany);

router.get('/logs', controller.listLogs);

module.exports = router;
