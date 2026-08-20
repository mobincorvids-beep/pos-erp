const mongoose = require('mongoose');
const Company = require('../../models/Company');
const Branch = require('../../models/Branch');
const User = require('../../models/User');
const Sale = require('../../models/Sale');
const companyProvisioningService = require('../../services/companyProvisioningService');
const auditService = require('../../services/auditService');
const { INDUSTRIES, OPTIONAL_MODULES } = require('../../constants/industries');

async function list(req, res) {
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.industryType) filter.industryType = req.query.industryType;

  const companies = await Company.find(filter).sort({ createdAt: -1 }).limit(200);

  // Cheap per-company counts in parallel — fine at this scale; if the
  // platform grows to thousands of tenants, replace with a single
  // aggregation ($lookup) instead of N+1 queries.
  const withCounts = await Promise.all(companies.map(async (c) => {
    const [branchCount, userCount] = await Promise.all([
      Branch.countDocuments({ companyId: c._id }),
      User.countDocuments({ companyId: c._id }),
    ]);
    return { ...c.toObject(), branchCount, userCount };
  }));

  res.json(withCounts);
}

async function get(req, res) {
  const company = await Company.findById(req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found.' });

  const [branches, users] = await Promise.all([
    Branch.find({ companyId: company._id }),
    User.find({ companyId: company._id }).select('-passwordHash'),
  ]);

  res.json({ company, branches, users });
}

async function onboard(req, res) {
  try {
    const result = await companyProvisioningService.onboardCompany(req.body);
    await auditService.record({
      companyId: result.company._id, userId: null, action: 'company.onboarded',
      entityType: 'Company', entityId: result.company._id,
      metadata: { onboardedByAdminId: req.platformAdmin.adminId },
    });
    res.status(201).json({
      company: result.company,
      admin: { name: result.admin.name, email: result.admin.email },
      // Returned once, on creation only — never retrievable again, same
      // principle as a cloud provider showing you an API key exactly once.
      generatedPassword: result.generatedPassword,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function update(req, res) {
  const allowedFields = ['name', 'industryType', 'currency', 'ntn', 'strn', 'fbrPosId', 'phone', 'email', 'address', 'taxAuthorities', 'parentCompanyId'];
  const patch = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  }

  const company = await Company.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!company) return res.status(404).json({ error: 'Company not found.' });

  await auditService.record({
    companyId: company._id, userId: null, action: 'company.updated',
    entityType: 'Company', entityId: company._id, metadata: { patch, byAdminId: req.platformAdmin.adminId },
  });
  res.json(company);
}

async function setActive(req, res) {
  const { isActive } = req.body;
  const company = await Company.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
  if (!company) return res.status(404).json({ error: 'Company not found.' });

  await auditService.record({
    companyId: company._id, userId: null, action: isActive ? 'company.activated' : 'company.suspended',
    entityType: 'Company', entityId: company._id, metadata: { byAdminId: req.platformAdmin.adminId },
  });
  res.json(company);
}

async function setModules(req, res) {
  const { activeModules } = req.body;
  if (!Array.isArray(activeModules)) return res.status(400).json({ error: 'activeModules must be an array of module keys.' });

  const company = await Company.findByIdAndUpdate(req.params.id, { activeModules }, { new: true });
  if (!company) return res.status(404).json({ error: 'Company not found.' });

  await auditService.record({
    companyId: company._id, userId: null, action: 'company.modules_updated',
    entityType: 'Company', entityId: company._id, metadata: { activeModules, byAdminId: req.platformAdmin.adminId },
  });
  res.json(company);
}

async function salesVolume(req, res) {
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const totals = await Sale.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(req.params.id), status: 'completed', createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: null, netSales: { $sum: '$totalAmount' }, invoiceCount: { $sum: 1 } } },
  ]);

  res.json({ from, to, netSales: totals[0]?.netSales || 0, invoiceCount: totals[0]?.invoiceCount || 0 });
}

function catalog(req, res) {
  res.json({ industries: INDUSTRIES, optionalModules: OPTIONAL_MODULES });
}

module.exports = { list, get, onboard, update, setActive, setModules, salesVolume, catalog };
