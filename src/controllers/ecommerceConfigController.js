const Company = require('../models/Company');
const ecommerceService = require('../services/ecommerceService');

async function getConfig(req, res) {
  const company = await Company.findById(req.companyId);
  res.json(company.ecommerceConfig || { enabled: false });
}

/** Enables (or re-configures) the integration and issues/rotates the webhook token — shown once in the response, same principle as the platform-admin onboarding password. */
async function enable(req, res) {
  try {
    const company = await Company.findById(req.companyId);
    await ecommerceService.enableAndRotateToken(company, req.body);
    res.json({
      enabled: true,
      webhookToken: company.ecommerceConfig.webhookToken,
      webhookUrl: `/api/v1/ecommerce/${company.slug}/orders`,
      productFeedUrl: `/api/v1/ecommerce/${company.slug}/products`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function disable(req, res) {
  const company = await Company.findById(req.companyId);
  await ecommerceService.disable(company);
  res.json({ enabled: false });
}

module.exports = { getConfig, enable, disable };
