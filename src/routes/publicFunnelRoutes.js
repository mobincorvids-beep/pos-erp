const router = require('express').Router();
const controller = require('../controllers/funnelController');

// PUBLIC — a customer lands here with no login at all, so this router
// deliberately has NO requireAuth/scopeToCompany, mirroring the existing
// no-JWT public pattern in src/routes/ecommerceWebhookRoutes.js (an
// external store also has no user session; that router's whole "auth
// story" is a webhook token instead of a JWT). Here there isn't even a
// token — funnelController.publicGetFunnel/publicSubmitFunnel only ever
// resolve and act on a PUBLISHED funnel (see funnelService), so a
// draft/archived funnel is never reachable through this router no matter
// what slug is guessed.
router.get('/:slug', controller.publicGetFunnel);
router.post('/:slug/submit', controller.publicSubmitFunnel);

module.exports = router;
