const couponService = require('../services/couponService');

async function createCoupon(req, res) {
  try { res.status(201).json(await couponService.createCoupon(req.companyId, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function listCoupons(req, res) {
  res.json(await couponService.listCoupons(req.companyId, req.query));
}

async function setActive(req, res) {
  try { res.json(await couponService.setActive(req.companyId, req.params.id, req.body.active)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

/** POS-facing preview: check a code and see the discount amount before finalizing a sale. Never mutates usage. */
async function validate(req, res) {
  try {
    const { code, customerId, purchaseAmount } = req.body;
    const result = await couponService.validateCoupon(req.companyId, code, { customerId, purchaseAmount });
    res.json({ coupon: result.coupon, discountAmount: result.discountAmount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { createCoupon, listCoupons, setActive, validate };
