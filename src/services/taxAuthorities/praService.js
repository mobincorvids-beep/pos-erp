const { createAuthorityService } = require('./authorityFactory');
module.exports = createAuthorityService({
  name: 'PRA', baseUrlEnvVar: 'PRA_API_BASE_URL', defaultBaseUrl: 'https://ptms.pra.punjab.gov.pk/api', tokenEnvVar: 'PRA_API_TOKEN',
});
