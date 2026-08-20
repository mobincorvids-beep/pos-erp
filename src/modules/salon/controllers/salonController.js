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
  listServices, createService, billService,
  listPackages, createPackage, sellMembership, customerMemberships,
  applyCommissionsToPayroll, listCommissions,
};
