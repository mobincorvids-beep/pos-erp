/**
 * CustomReportService — builds and runs a safe Mongo aggregation pipeline
 * from a user-authored report spec (CustomReport), instead of the
 * business being limited to whatever fixed reports reportingService
 * happens to already expose. "Safe" means: the source collection must be
 * one of SOURCE_REGISTRY's explicit entries (never an arbitrary model
 * name), and every field referenced in filters/groupBy/metrics must be in
 * that entry's own allowlist — this is what keeps a report builder from
 * becoming a way to read data the report author shouldn't see or to
 * probe the schema of models that were never meant to be reportable.
 */
const mongoose = require('mongoose');
const CustomReport = require('../models/CustomReport');
const Sale = require('../models/Sale');
const PurchaseOrder = require('../models/PurchaseOrder');
const Expense = require('../models/Expense');
const StockMovement = require('../models/StockMovement');

// One entry per reportable source. `dateField` is used for any 'between'
// filter shorthand on a date range; `allowedFields` caps what a filter,
// groupBy, or metric can reference — anything else is rejected rather than
// silently ignored, so a bad report definition fails loudly at save/run
// time instead of quietly reporting wrong numbers.
const SOURCE_REGISTRY = {
  Sale: {
    model: Sale,
    dateField: 'createdAt',
    allowedFields: ['status', 'saleType', 'channel', 'warehouseId', 'customerId', 'totalAmount', 'subtotal', 'taxAmount', 'discountAmount', 'paidAmount', 'dueAmount', 'createdAt'],
  },
  PurchaseOrder: {
    model: PurchaseOrder,
    dateField: 'createdAt',
    allowedFields: ['status', 'supplierId', 'warehouseId', 'totalAmount', 'isDropShip', 'createdAt'],
  },
  Expense: {
    model: Expense,
    dateField: 'date',
    allowedFields: ['categoryId', 'amount', 'status', 'branchId', 'date'],
  },
  StockMovement: {
    model: StockMovement,
    dateField: 'createdAt',
    allowedFields: ['type', 'warehouseId', 'productId', 'variantId', 'quantity', 'unitCost', 'createdAt'],
  },
};

function assertAllowedField(sourceEntry, field, context) {
  if (!sourceEntry.allowedFields.includes(field)) {
    throw new Error(`Field "${field}" is not reportable on this source (${context}).`);
  }
}

const OPERATOR_MAP = {
  eq: '$eq', ne: '$ne', gt: '$gt', gte: '$gte', lt: '$lt', lte: '$lte', in: '$in',
};

function buildMatchStage(companyId, sourceEntry, filters) {
  const match = { companyId: new mongoose.Types.ObjectId(companyId) };
  for (const f of filters || []) {
    assertAllowedField(sourceEntry, f.field, 'filter');
    if (f.operator === 'between') {
      if (!Array.isArray(f.value) || f.value.length !== 2) {
        throw new Error(`"between" filter on "${f.field}" needs a [min, max] value.`);
      }
      match[f.field] = { $gte: f.value[0], $lte: f.value[1] };
    } else {
      const op = OPERATOR_MAP[f.operator];
      if (!op) throw new Error(`Unsupported filter operator "${f.operator}".`);
      match[f.field] = { [op]: f.value };
    }
  }
  return match;
}

function buildGroupStage(sourceEntry, groupByField, metrics) {
  const group = { _id: groupByField ? `$${groupByField}` : null };
  for (const m of metrics || []) {
    if (m.aggregation !== 'count') assertAllowedField(sourceEntry, m.field, 'metric');
    const key = m.label || `${m.aggregation}_${m.field}`;
    if (m.aggregation === 'count') group[key] = { $sum: 1 };
    else group[key] = { [`$${m.aggregation}`]: `$${m.field}` };
  }
  if (metrics.length === 0) group.count = { $sum: 1 }; // always return at least a row count
  return group;
}

/** Validates a spec (source + every referenced field) without running it — used by the create/update endpoints so a bad report is rejected at save time. */
function validateSpec(spec) {
  const sourceEntry = SOURCE_REGISTRY[spec.sourceCollection];
  if (!sourceEntry) {
    throw new Error(`Unknown report source "${spec.sourceCollection}". Allowed: ${Object.keys(SOURCE_REGISTRY).join(', ')}.`);
  }
  if (spec.groupByField) assertAllowedField(sourceEntry, spec.groupByField, 'groupBy');
  for (const f of spec.filters || []) assertAllowedField(sourceEntry, f.field, 'filter');
  for (const m of spec.metrics || []) {
    if (m.aggregation !== 'count') assertAllowedField(sourceEntry, m.field, 'metric');
  }
  return sourceEntry;
}

async function runSpec(companyId, spec) {
  const sourceEntry = validateSpec(spec);
  const pipeline = [
    { $match: buildMatchStage(companyId, sourceEntry, spec.filters) },
    { $group: buildGroupStage(sourceEntry, spec.groupByField, spec.metrics || []) },
  ];
  if (spec.sortBy) {
    pipeline.push({ $sort: { [spec.sortBy]: spec.sortDirection === 'asc' ? 1 : -1 } });
  }
  pipeline.push({ $limit: spec.limit || 100 });

  const rows = await sourceEntry.model.aggregate(pipeline);
  return rows.map((r) => ({ groupKey: r._id, ...r, _id: undefined }));
}

async function createReport(companyId, spec, userId) {
  validateSpec(spec);
  return CustomReport.create({ ...spec, companyId, createdBy: userId });
}

async function updateReport(companyId, reportId, spec) {
  validateSpec({ ...spec, sourceCollection: spec.sourceCollection });
  const report = await CustomReport.findOneAndUpdate({ _id: reportId, companyId }, spec, { new: true, runValidators: true });
  if (!report) throw new Error('Report not found.');
  return report;
}

function listReports(companyId) {
  return CustomReport.find({ companyId }).sort({ name: 1 });
}

async function getReport(companyId, reportId) {
  return CustomReport.findOne({ _id: reportId, companyId });
}

async function deleteReport(companyId, reportId) {
  const result = await CustomReport.deleteOne({ _id: reportId, companyId });
  if (result.deletedCount === 0) throw new Error('Report not found.');
  return { deleted: true };
}

async function runReport(companyId, reportId) {
  const report = await CustomReport.findOne({ _id: reportId, companyId });
  if (!report) throw new Error('Report not found.');
  return runSpec(companyId, report.toObject());
}

module.exports = {
  SOURCE_REGISTRY: Object.keys(SOURCE_REGISTRY),
  sourceFields: (name) => SOURCE_REGISTRY[name]?.allowedFields || [],
  createReport, updateReport, listReports, getReport, deleteReport, runReport,
  previewReport: runSpec, // run an unsaved spec directly, same validation
};
