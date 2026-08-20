/**
 * BraService — Balochistan Revenue Authority sales-tax-on-services
 * e-invoicing. See authorityFactory.js and ./README.md: BRA's real API
 * spec is not public — defaultBaseUrl below is an unverified placeholder,
 * confirm the real endpoint/payload against BRA's own developer docs.
 */
const { createAuthorityService } = require('./authorityFactory');
module.exports = createAuthorityService({
  name: 'BRA', baseUrlEnvVar: 'BRA_API_BASE_URL', defaultBaseUrl: 'https://bra.gob.pk/api', tokenEnvVar: 'BRA_API_TOKEN',
});
