const apiKeyService = require('../services/apiKeyService');

async function list(req, res) {
  res.json(await apiKeyService.listApiKeys(req.companyId));
}

async function scopes(req, res) {
  res.json(apiKeyService.AVAILABLE_SCOPES);
}

async function create(req, res) {
  try {
    const { name, scopes: requestedScopes } = req.body;
    const result = await apiKeyService.createApiKey(req.companyId, {
      name, scopes: requestedScopes || [], userId: req.auth?.userId,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function revoke(req, res) {
  try {
    await apiKeyService.revokeApiKey(req.companyId, req.params.id);
    res.json({ revoked: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

module.exports = { list, scopes, create, revoke };
