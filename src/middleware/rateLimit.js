const rateLimit = require('express-rate-limit');

/**
 * Two tiers: a generous general limit so normal API use never hits it, and
 * a much stricter one specifically on login endpoints — brute-forcing a
 * password is the attack rate limiting actually needs to stop, so login
 * gets its own tighter budget rather than sharing the general one.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // ~40 req/min sustained — comfortable for a POS terminal, not for a scraper
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down and try again shortly.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 login attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please wait a few minutes before trying again.' },
  skipSuccessfulRequests: true, // only failed attempts count against the budget
});

module.exports = { generalLimiter, authLimiter };
