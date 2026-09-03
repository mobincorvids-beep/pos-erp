const BillOfMaterials = require('../models/BillOfMaterials');
const WorkOrder = require('../models/WorkOrder');
const MrpRun = require('../models/MrpRun');
const manufacturingService = require('../services/manufacturingService');
const mrpService = require('../services/mrpService');

async function listBOMs(req, res) {
  const rows = await BillOfMaterials.find({ companyId: req.companyId, isActive: true });
  res.json(rows);
}

async function createBOM(req, res) {
  try {
    const bom = await manufacturingService.createBOM({ ...req.body, companyId: req.companyId });
    res.status(201).json(bom);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listWorkOrders(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await WorkOrder.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(rows);
}

async function createWorkOrder(req, res) {
  try {
    const workOrder = await manufacturingService.createWorkOrder({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(workOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function start(req, res) {
  try {
    const workOrder = await manufacturingService.startProduction(req.params.id, req.auth.userId);
    res.json(workOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function complete(req, res) {
  try {
    const workOrder = await manufacturingService.completeProduction(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(workOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function recordOperation(req, res) {
  try {
    const workOrder = await manufacturingService.recordOperationActuals(
      req.params.id, req.params.operationId, { ...req.body, userId: req.auth.userId }
    );
    res.json(workOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Work Centers ---

async function listWorkCenters(req, res) {
  const rows = await manufacturingService.listWorkCenters(req.companyId);
  res.json(rows);
}

async function createWorkCenter(req, res) {
  try {
    const wc = await manufacturingService.createWorkCenter({ ...req.body, companyId: req.companyId });
    res.status(201).json(wc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateWorkCenter(req, res) {
  try {
    const wc = await manufacturingService.updateWorkCenter(req.params.id, req.companyId, req.body);
    res.json(wc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Routings ---

async function listRoutings(req, res) {
  const rows = await manufacturingService.listRoutings(req.companyId, req.query.bomId);
  res.json(rows);
}

async function createRouting(req, res) {
  try {
    const routing = await manufacturingService.createRouting({ ...req.body, companyId: req.companyId });
    res.status(201).json(routing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- MRP ---

async function listMrpRuns(req, res) {
  const rows = await MrpRun.find({ companyId: req.companyId }).sort({ createdAt: -1 }).limit(50);
  res.json(rows);
}

async function getMrpRun(req, res) {
  try {
    const run = await mrpService.getMrpRun(req.companyId, req.params.id);
    res.json(run);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

async function runMrp(req, res) {
  try {
    const run = await mrpService.runMrp({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(run);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function convertPurchaseLine(req, res) {
  try {
    const result = await mrpService.convertPurchaseLine(
      req.companyId, req.params.id, req.params.lineId, { ...req.body, userId: req.auth.userId }
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function convertWorkOrderLine(req, res) {
  try {
    const result = await mrpService.convertWorkOrderLine(
      req.companyId, req.params.id, req.params.lineId, { ...req.body, userId: req.auth.userId }
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Reporting ---

async function efficiencyReport(req, res) {
  const rows = await manufacturingService.getEfficiencyReport(req.companyId, req.query);
  res.json(rows);
}

async function costVarianceReport(req, res) {
  try {
    const report = await manufacturingService.getCostVarianceReport(req.companyId, req.query);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function capacityDashboard(req, res) {
  try {
    const dashboard = await manufacturingService.getCapacityDashboard(req.companyId, req.query);
    res.json(dashboard);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function recordOperationQc(req, res) {
  try {
    const workOrder = await manufacturingService.recordOperationQc(
      req.params.id, req.params.operationIndex, { ...req.body, checkedBy: req.auth.userId }
    );
    res.json(workOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  listBOMs, createBOM,
  listWorkOrders, createWorkOrder, start, complete, recordOperation, recordOperationQc,
  listWorkCenters, createWorkCenter, updateWorkCenter,
  listRoutings, createRouting,
  listMrpRuns, getMrpRun, runMrp, convertPurchaseLine, convertWorkOrderLine,
  efficiencyReport, costVarianceReport, capacityDashboard,
};
