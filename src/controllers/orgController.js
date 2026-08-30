const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const PosTerminal = require('../models/PosTerminal');
const Account = require('../models/Account');
const Company = require('../models/Company');

/** Editable-by-tenant subset of Company — deliberately excludes activeModules,
 * defaultAccounts, ecommerceConfig, parentCompanyId etc., which are either
 * platform-admin controlled or wired automatically at provisioning time. */
const EDITABLE_COMPANY_FIELDS = ['name', 'ntn', 'strn', 'fbrPosId', 'phone', 'email', 'address', 'currency', 'timezone'];

async function getCompany(req, res) {
  const company = await Company.findById(req.companyId);
  if (!company) return res.status(404).json({ error: 'Company not found.' });
  res.json(company);
}

async function updateCompany(req, res) {
  const updates = {};
  for (const field of EDITABLE_COMPANY_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  // jazzCashTaxPay is a per-tenant credential block for paying the
  // company's own FBR tax liability (see taxPaymentService) — merged
  // shallowly onto whatever's already there so a caller can update just
  // one field (e.g. flipping `enabled`) without re-sending the rest.
  if (req.body.jazzCashTaxPay && typeof req.body.jazzCashTaxPay === 'object') {
    const existing = await Company.findById(req.companyId).select('jazzCashTaxPay');
    updates.jazzCashTaxPay = { ...(existing?.jazzCashTaxPay?.toObject?.() || existing?.jazzCashTaxPay || {}), ...req.body.jazzCashTaxPay };
  }
  const company = await Company.findByIdAndUpdate(req.companyId, updates, { new: true, runValidators: true });
  if (!company) return res.status(404).json({ error: 'Company not found.' });
  res.json(company);
}

async function listBranches(req, res) {
  const rows = await Branch.find({ companyId: req.companyId, isActive: true });
  res.json(rows);
}

/** Creates a new branch for the caller's company, plus its own warehouse and
 * POS terminal — mirrors what onboardCompany() sets up for the first branch,
 * so a second/third branch is just as usable at checkout immediately. */
async function createBranch(req, res) {
  const { name, code, address, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Branch name is required.' });

  const branch = await Branch.create({ companyId: req.companyId, name, code, address, phone });
  const warehouse = await Warehouse.create({
    companyId: req.companyId, branchId: branch._id, name: `${name} Warehouse`, isActive: true,
  });
  const terminal = await PosTerminal.create({
    companyId: req.companyId, branchId: branch._id, name: `${name} Counter 1`, isActive: true,
  });
  res.status(201).json({ branch, warehouse, terminal });
}

async function updateBranch(req, res) {
  const { name, code, address, phone } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (code !== undefined) updates.code = code;
  if (address !== undefined) updates.address = address;
  if (phone !== undefined) updates.phone = phone;

  const branch = await Branch.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId }, updates, { new: true, runValidators: true }
  );
  if (!branch) return res.status(404).json({ error: 'Branch not found.' });
  res.json(branch);
}

/** Soft-deletes a branch (isActive: false) rather than a hard delete, since
 * sales/inventory/vouchers already reference it by id — same pattern used
 * everywhere else in this codebase (products, warehouses, accounts). Refuses
 * to deactivate a company's only remaining branch. */
async function deactivateBranch(req, res) {
  const activeCount = await Branch.countDocuments({ companyId: req.companyId, isActive: true });
  if (activeCount <= 1) {
    return res.status(400).json({ error: 'Cannot remove the only branch — every business needs at least one.' });
  }
  const branch = await Branch.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId }, { isActive: false }, { new: true }
  );
  if (!branch) return res.status(404).json({ error: 'Branch not found.' });
  res.json({ ok: true });
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

module.exports = {
  getCompany, updateCompany,
  listBranches, createBranch, updateBranch, deactivateBranch,
  listWarehouses, listPosTerminals, listAccounts,
};
