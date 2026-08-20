/**
 * PraService — Punjab Revenue Authority sales-tax-on-services e-invoicing.
 * See authorityFactory.js and ./README.md: PRA's real API spec is not
 * public — defaultBaseUrl below is an unverified placeholder, confirm the
 * real endpoint/payload against PRA's own developer docs.
 */
const { createAuthorityService } = require('./authorityFactory');
module.exports = createAuthorityService({
  name: 'PRA', baseUrlEnvVar: 'PRA_API_BASE_URL', defaultBaseUrl: 'https://ptms.pra.punjab.gov.pk/api', tokenEnvVar: 'PRA_API_TOKEN',
});
