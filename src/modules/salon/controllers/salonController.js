const salonService = require('../services/salonService');

async function listServices(req, res) {
  const rows = await salonService.listServices(req.companyId);
  res.json(rows);
}

async function createService(req, res) {
  try {
    const service = await salonService.createService({ ...req.body, companyId: req.companyId });
    res.status(201).json(service);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateService(req, res) {
  try {
    const service = await salonService.updateService(req.companyId, req.params.id, req.body);
    if (!service) return res.status(404).json({ error: 'Service not found.' });
    res.json(service);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deactivateService(req, res) {
  const service = await salonService.deactivateService(req.companyId, req.params.id);
  if (!service) return res.status(404).json({ error: 'Service not found.' });
  res.json({ ok: true });
}

async function billService(req, res) {
  try {
    const result = await salonService.billServiceWithCommission({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listPackages(req, res) {
  const rows = await salonService.listMembershipPackages(req.companyId);
  res.json(rows);
}

async function createPackage(req, res) {
  try {
    const pkg = await salonService.createMembershipPackage({ ...req.body, companyId: req.companyId });
    res.status(201).json(pkg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updatePackage(req, res) {
  try {
    const pkg = await salonService.updateMembershipPackage(req.companyId, req.params.id, req.body);
    if (!pkg) return res.status(404).json({ error: 'Package not found.' });
    res.json(pkg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deactivatePackage(req, res) {
  const pkg = await salonService.deactivateMembershipPackage(req.companyId, req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found.' });
  res.json({ ok: true });
}

async function sellMembership(req, res) {
  try {
    const result = await salonService.sellMembership({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function customerMemberships(req, res) {
  const rows = await salonService.listCustomerMemberships(req.companyId, req.params.customerId);
  res.json(rows);
}

async function applyCommissionsToPayroll(req, res) {
  try {
    const applied = await salonService.applyCommissionsToPayroll(req.params.payrollRunId, Number(req.body.month), Number(req.body.year), req.companyId);
    res.json(applied);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listCommissions(req, res) {
  const rows = await salonService.listCommissions(req.companyId, req.query.employeeId || null);
  res.json(rows);
}

module.exports = {
  listServices, createService, updateService, deactivateService, billService,
  listPackages, createPackage, updatePackage, deactivatePackage, sellMembership, customerMemberships,
  applyCommissionsToPayroll, listCommissions,
};
