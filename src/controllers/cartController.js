/**
 * Cart controller — mounted behind requirePortalAuth (see routes file),
 * same pattern wishlistController.js/wishlistService.js use: the
 * customerId always comes from req.portalAuth, never the request body, so
 * a customer can never read or modify another customer's cart. Anonymous
 * (pre-login) carts are supported at the model/service level via
 * sessionId, for a storefront to wire up later behind its own
 * session-identification scheme — this controller only exposes the
 * logged-in-customer path.
 */
const cartService = require('../services/cartService');

async function getCart(req, res) {
  try {
    const cart = await cartService.list(req.portalAuth.companyId, { customerId: req.portalAuth.customerId });
    res.json(cart);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function addItem(req, res) {
  try {
    const cart = await cartService.addItem(req.portalAuth.companyId, { customerId: req.portalAuth.customerId }, req.body);
    res.status(201).json(cart);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateItem(req, res) {
  try {
    const cart = await cartService.updateItem(req.portalAuth.companyId, { customerId: req.portalAuth.customerId }, req.body);
    res.json(cart);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function clear(req, res) {
  try {
    const cart = await cartService.clear(req.portalAuth.companyId, { customerId: req.portalAuth.customerId });
    res.json(cart);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { getCart, addItem, updateItem, clear };
