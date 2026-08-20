const giftRegistryService = require('../services/giftRegistryService');

async function createRegistry(req, res) {
  try {
    const registry = await giftRegistryService.createRegistry({ ...req.body, companyId: req.companyId });
    res.status(201).json(registry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getRegistry(req, res) {
  const registry = await giftRegistryService.getRegistry(req.params.id);
  if (!registry) return res.status(404).json({ error: 'Registry not found.' });
  res.json(registry);
}

async function listRegistries(req, res) {
  const rows = await giftRegistryService.listRegistries(req.companyId, req.query);
  res.json(rows);
}

async function purchaseFromRegistry(req, res) {
  try {
    const result = await giftRegistryService.purchaseFromRegistry(req.params.id, req.params.itemId, { ...req.body, userId: req.auth.userId });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { createRegistry, getRegistry, listRegistries, purchaseFromRegistry };
