/**
 * SrbService — Sindh Revenue Board sales-tax-on-services e-invoicing.
 * See authorityFactory.js and ./README.md for important caveats: SRB's
 * real API spec is not public — defaultBaseUrl below is an unverified
 * placeholder, and buildInvoicePayload's shape must be confirmed against
 * SRB's actual registered-taxpayer documentation before going live.
 */
const { createAuthorityService } = require('./authorityFactory');
module.exports = createAuthorityService({
  name: 'SRB', baseUrlEnvVar: 'SRB_API_BASE_URL', defaultBaseUrl: 'https://e.srb.gos.pk/api', tokenEnvVar: 'SRB_API_TOKEN',
});
