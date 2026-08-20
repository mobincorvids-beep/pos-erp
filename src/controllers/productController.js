const Product = require('../models/Product');

async function list(req, res) {
  const products = await Product.find({ companyId: req.companyId, isActive: true }).limit(200);
  res.json(products);
}

async function create(req, res) {
  const product = await Product.create({ ...req.body, companyId: req.companyId });
  res.status(201).json(product);
}

async function findByBarcode(req, res) {
  const { barcode } = req.params;
  const product = await Product.findOne({ companyId: req.companyId, barcode });
  if (!product) return res.status(404).json({ error: 'Product not found for this barcode.' });
  res.json(product);
}

module.exports = { list, create, findByBarcode };
