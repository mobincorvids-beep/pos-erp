const purchaseService = require('../services/purchaseService');
const unitConversionService = require('../services/unitConversionService');
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceivedNote = require('../models/GoodsReceivedNote');

/**
 * Real multi-UOM entry point: items are expressed in whatever unit the
 * purchase actually happened in (e.g. "2 cartons"), converted to the
 * product's own tracking unit (quantity AND unit cost both converted,
 * preserving the true total cost), then handed to the exact same
 * createPurchaseOrder() every other PO already goes through — core
 * Purchasing never has to know multi-UOM exists.
 */
async function createOrderFromAlternateUnits(req, res) {
  try {
    const convertedItems = await unitConversionService.convertPurchaseItemsToProductUnits(req.body.items);
    const po = await purchaseService.createPurchaseOrder({ ...req.body, items: convertedItems, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(po);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createOrder(req, res) {
  try {
    const po = await purchaseService.createPurchaseOrder({
      ...req.body,
      companyId: req.companyId,
      userId: req.auth.userId,
    });
    res.status(201).json(po);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function receive(req, res) {
  try {
    const grn = await purchaseService.receiveGoods({
      ...req.body,
      purchaseOrderId: req.params.id,
      userId: req.auth.userId,
    });
    res.status(201).json(grn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const orders = await PurchaseOrder.find({ companyId: req.companyId }).limit(200);
  res.json(orders);
}

async function get(req, res) {
  const po = await PurchaseOrder.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!po) return res.status(404).json({ error: 'Purchase order not found.' });
  res.json(po);
}

async function decide(req, res) {
  try {
    const po = await purchaseService.decidePurchaseOrder(req.params.id, { approve: req.body.approve, userId: req.auth.userId, note: req.body.note });
    res.json(po);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listGRNs(req, res) {
  // companyId isn't stored directly on the PO the query is filtering by
  // here — go through the PO to keep this tenant-scoped, same as every
  // other cross-reference in this controller.
  const po = await PurchaseOrder.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!po) return res.status(404).json({ error: 'Purchase order not found.' });

  const grns = await GoodsReceivedNote.find({ purchaseOrderId: po._id }).sort({ createdAt: -1 });
  res.json(grns);
}

async function recordQC(req, res) {
  try {
    const grn = await purchaseService.recordQC(req.params.grnId, req.params.itemId, {
      passed: req.body.passed, note: req.body.note, userId: req.auth.userId,
    });
    res.json(grn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { createOrder, createOrderFromAlternateUnits, receive, list, get, decide, listGRNs, recordQC };
