const { validationResult } = require('express-validator');

/**
 * Runs after a route's express-validator chain and turns any failure into
 * the same { error: "..." } shape every other controller already returns,
 * so the client's error handling doesn't need a special case for
 * validation errors vs business-logic errors.
 *
 * Applied to the highest-risk endpoints in this pass — auth (credential
 * shape), checkout (the numbers that move real money/stock), and account
 * mutations — not every route in the API. See README for which endpoints
 * have it and the reasoning for not doing all ~200 as a blanket pass.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

module.exports = { validate };
