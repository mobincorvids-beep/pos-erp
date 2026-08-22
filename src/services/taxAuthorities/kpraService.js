const { createAuthorityService } = require('./authorityFactory');
module.exports = createAuthorityService({
  name: 'KPRA', baseUrlEnvVar: 'KPRA_API_BASE_URL', defaultBaseUrl: 'https://kpra.kp.gov.pk/api', tokenEnvVar: 'KPRA_API_TOKEN',
});
