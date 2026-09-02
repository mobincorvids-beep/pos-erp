const router = require('express').Router();
const controller = require('../controllers/reviewRequestController');

// PUBLIC — a customer lands here from a review-request link with no login
// at all, same pattern as publicFunnelRoutes.js: no requireAuth/
// scopeToCompany, the token in the URL (ReviewRequest.publicReviewLink)
// IS the auth. Mounted at /public/reviews (see src/routes/index.js).
router.get('/:token', controller.publicGet);
router.post('/:token/respond', controller.publicRespond);
router.post('/:token/share', controller.publicShare);

module.exports = router;
