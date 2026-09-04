const Sale = require('../models/Sale');
const salesOrderService = require('../services/salesOrderService');

async function listQuotations(req, res) {
  const docs = await Sale.find({ companyId: req.companyId, saleType: 'quotation' }).sort({ createdAt: -1 }).limit(200);
  res.json(docs);
}

async function listSalesOrders(req, res) {
  const docs = await Sale.find({ companyId: req.companyId, saleType: 'sales_order' }).sort({ createdAt: -1 }).limit(200);
  res.json(docs);
}

async function createQuotation(req, res) {
  try {
    const doc = await salesOrderService.createQuotation({
      ...req.body, companyId: req.companyId, userId: req.auth.userId,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createSalesOrder(req, res) {
  try {
    const doc = await salesOrderService.createSalesOrder({
      ...req.body, companyId: req.companyId, userId: req.auth.userId,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function acceptQuotation(req, res) {
  try {
    const salesOrder = await salesOrderService.convertQuotationToSalesOrder(req.params.id);
    res.json(salesOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function convertToInvoice(req, res) {
  try {
    const sale = await salesOrderService.convertToInvoice(req.params.id, req.body);
    res.json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function cancel(req, res) {
  try {
    const doc = await salesOrderService.cancel(req.params.id);
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * PUBLIC — no staff auth, no JWT. See publicOrderTrackingRoutes.js: the
 * order number + phone the caller supplies IS the auth, same pattern as
 * publicFunnelRoutes.js/publicReviewRoutes.js. Returns 404 for anything
 * that doesn't match — a wrong order number and a right order number with
 * the wrong phone look identical, deliberately, so this can't be used to
 * enumerate orders or confirm a phone number is on file.
 */
async function publicTrackOrder(req, res) {
  try {
    const { orderNumber, phone } = req.query;
    const summary = await salesOrderService.getPublicOrderStatus(orderNumber, phone);
    if (!summary) return res.status(404).json({ error: 'No matching order found.' });
    res.json(summary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function placeOrderHold(req, res) {
  try {
    const sale = await salesOrderService.placeOrderHold(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function releaseOrderHold(req, res) {
  try {
    const sale = await salesOrderService.releaseOrderHold(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getConsolidatedOrders(req, res) {
  try {
    const { channel, status, from, to } = req.query;
    const orders = await salesOrderService.getConsolidatedOrders(req.companyId, { channel, status, from, to });
    res.json(orders);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function splitOrder(req, res) {
  try {
    const doc = await salesOrderService.splitOrder(req.params.id, req.body);
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function fulfillPartially(req, res) {
  try {
    const result = await salesOrderService.fulfillPartially(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function mergeOrders(req, res) {
  try {
    const doc = await salesOrderService.mergeOrders(req.body.saleIds, req.body.targetCustomerId);
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  listQuotations, listSalesOrders, createQuotation, createSalesOrder, acceptQuotation, convertToInvoice, cancel,
  publicTrackOrder,
  placeOrderHold, releaseOrderHold, getConsolidatedOrders, splitOrder, mergeOrders, fulfillPartially,
};
