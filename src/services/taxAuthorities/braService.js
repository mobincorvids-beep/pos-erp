const { createAuthorityService } = require('./authorityFactory');
module.exports = createAuthorityService({
  name: 'BRA', baseUrlEnvVar: 'BRA_API_BASE_URL', defaultBaseUrl: 'https://bra.gob.pk/api', tokenEnvVar: 'BRA_API_TOKEN',
});
