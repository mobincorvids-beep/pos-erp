const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const PosTerminal = require('../models/PosTerminal');
const Account = require('../models/Account');

async function listBranches(req, res) {
  const rows = await Branch.find({ companyId: req.companyId, isActive: true });
  res.json(rows);
}

async function listWarehouses(req, res) {
  const filter = { companyId: req.companyId, isActive: true };
  if (req.query.branchId) filter.branchId = req.query.branchId;
  const rows = await Warehouse.find(filter);
  res.json(rows);
}

async function listPosTerminals(req, res) {
  const filter = { companyId: req.companyId, isActive: true };
  if (req.query.branchId) filter.branchId = req.query.branchId;
  const rows = await PosTerminal.find(filter);
  res.json(rows);
}

async function listAccounts(req, res) {
  const filter = { companyId: req.companyId, isActive: true };
  if (req.query.paymentOnly === 'true') filter.isPaymentAccount = true;
  if (req.query.type) filter.type = req.query.type;
  const rows = await Account.find(filter);
  res.json(rows);
}

module.exports = { listBranches, listWarehouses, listPosTerminals, listAccounts };
