const productChannelService = require('../services/productChannelService');

async function getEffective(req, res) {
  try {
    const { channel } = req.query;
    if (!channel) return res.status(400).json({ error: 'channel query param is required.' });
    const effective = await productChannelService.getEffectiveProductForChannel(req.params.id, channel);
    res.json(effective);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function setOverride(req, res) {
  try {
    const { channel, price, title, description, isVisible } = req.body;
    if (!channel) return res.status(400).json({ error: 'channel is required.' });
    const product = await productChannelService.setChannelOverride(req.companyId, req.params.id, channel, { price, title, description, isVisible });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function clearOverride(req, res) {
  try {
    const product = await productChannelService.setChannelOverride(req.companyId, req.params.id, req.params.channel, null);
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { getEffective, setOverride, clearOverride };
