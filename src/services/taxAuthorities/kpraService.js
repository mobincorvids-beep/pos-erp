/**
 * KpraService — Khyber Pakhtunkhwa Revenue Authority sales-tax-on-services
 * e-invoicing. See authorityFactory.js and ./README.md: KPRA's real API
 * spec is not public — defaultBaseUrl below is an unverified placeholder,
 * confirm the real endpoint/payload against KPRA's own developer docs.
 */
const { createAuthorityService } = require('./authorityFactory');
module.exports = createAuthorityService({
  name: 'KPRA', baseUrlEnvVar: 'KPRA_API_BASE_URL', defaultBaseUrl: 'https://kpra.kp.gov.pk/api', tokenEnvVar: 'KPRA_API_TOKEN',
});
