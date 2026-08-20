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

module.exports = { listQuotations, listSalesOrders, createQuotation, createSalesOrder, acceptQuotation, convertToInvoice, cancel };
