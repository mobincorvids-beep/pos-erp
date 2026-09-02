/**
 * AudienceSegmentService — CRUD for AudienceSegment plus
 * resolveSegmentMembers(), which runs a segment's flat ANDed condition
 * list against Customer (with a Sale aggregation for totalSpend /
 * lastPurchaseDate, and a LoyaltyTransaction lookup for loyaltyTier).
 */
const AudienceSegment = require('../models/AudienceSegment');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const LoyaltyProgram = require('../models/LoyaltyProgram');

function createSegment(input) {
  const { companyId, name, description, conditions } = input;
  if (!companyId) throw new Error('companyId is required.');
  if (!name) throw new Error('Segment name is required.');
  return AudienceSegment.create({ companyId, name, description: description || '', conditions: conditions || [] });
}

async function updateSegment(segmentId, companyId, updates) {
  const segment = await AudienceSegment.findOne({ _id: segmentId, companyId });
  if (!segment) throw new Error('Segment not found.');
  const { name, description, conditions } = updates;
  if (name !== undefined) segment.name = name;
  if (description !== undefined) segment.description = description;
  if (conditions !== undefined) segment.conditions = conditions;
  await segment.save();
  return segment;
}

function listSegments(companyId) {
  return AudienceSegment.find({ companyId }).sort({ createdAt: -1 });
}

function getSegment(segmentId, companyId) {
  return AudienceSegment.findOne({ _id: segmentId, companyId });
}

async function deleteSegment(segmentId, companyId) {
  const res = await AudienceSegment.deleteOne({ _id: segmentId, companyId });
  if (!res.deletedCount) throw new Error('Segment not found.');
  return { ok: true };
}

/**
 * Per-customer spend total and most recent purchase date, computed from
 * completed Sale documents (status: 'completed') for the company. Used to
 * evaluate totalSpend / lastPurchaseDate conditions without loading every
 * Sale into memory per segment resolution.
 */
async function customerSalesStats(companyId, customerIds) {
  const rows = await Sale.aggregate([
    { $match: { companyId, status: 'completed', customerId: { $in: customerIds } } },
    { $group: { _id: '$customerId', totalSpend: { $sum: '$totalAmount' }, lastPurchaseDate: { $max: '$invoiceDate' } } },
  ]);
  const map = new Map();
  for (const row of rows) map.set(String(row._id), { totalSpend: row.totalSpend || 0, lastPurchaseDate: row.lastPurchaseDate || null });
  return map;
}

/**
 * Loyalty tier is derived, not stored on Customer — this codebase's
 * LoyaltyProgram is a single flat program per company (no tiers table),
 * so "tier" here is a simple points-based bucketing: bronze/silver/gold
 * based on Customer.loyaltyPoints thresholds. If a company has no active
 * loyalty program, every customer resolves to 'none'.
 */
function loyaltyTierFor(customer, programActive) {
  if (!programActive) return 'none';
  const points = customer.loyaltyPoints || 0;
  if (points >= 5000) return 'gold';
  if (points >= 1000) return 'silver';
  if (points > 0) return 'bronze';
  return 'none';
}

function evaluateCondition(condition, customer, salesStats, tier) {
  const { field, operator, value } = condition;
  if (field === 'tags') {
    const tags = customer.tags || [];
    return operator === 'contains' && tags.includes(value);
  }
  if (field === 'totalSpend') {
    const spend = salesStats?.totalSpend || 0;
    if (operator === 'gte') return spend >= Number(value);
    if (operator === 'lte') return spend <= Number(value);
    return false;
  }
  if (field === 'lastPurchaseDate') {
    const last = salesStats?.lastPurchaseDate;
    if (!last) return false;
    const cutoff = new Date(value);
    if (operator === 'after') return new Date(last) >= cutoff; // purchased on/after cutoff (recently active)
    if (operator === 'before') return new Date(last) < cutoff; // last purchase before cutoff (lapsed)
    return false;
  }
  if (field === 'loyaltyTier') {
    return operator === 'equals' && tier === value;
  }
  return false;
}

/** Runs a segment's conditions (ANDed) against every customer in the company and returns the matching Customer docs. */
async function resolveSegmentMembers(segmentId, companyIdOverride) {
  const segment = companyIdOverride
    ? await AudienceSegment.findOne({ _id: segmentId, companyId: companyIdOverride })
    : await AudienceSegment.findById(segmentId);
  if (!segment) throw new Error('Segment not found.');

  const customers = await Customer.find({ companyId: segment.companyId });
  if (!segment.conditions.length) return customers;

  const needsSales = segment.conditions.some((c) => c.field === 'totalSpend' || c.field === 'lastPurchaseDate');
  const needsLoyalty = segment.conditions.some((c) => c.field === 'loyaltyTier');

  const salesMap = needsSales ? await customerSalesStats(segment.companyId, customers.map((c) => c._id)) : null;
  const loyaltyProgram = needsLoyalty ? await LoyaltyProgram.findOne({ companyId: segment.companyId }) : null;

  return customers.filter((customer) => {
    const stats = salesMap ? salesMap.get(String(customer._id)) : null;
    const tier = needsLoyalty ? loyaltyTierFor(customer, loyaltyProgram?.isActive) : null;
    return segment.conditions.every((cond) => evaluateCondition(cond, customer, stats, tier));
  });
}

async function previewSegment(segmentId, companyId) {
  const members = await resolveSegmentMembers(segmentId, companyId);
  return {
    count: members.length,
    members: members.map((c) => ({ _id: c._id, name: c.name, email: c.email, phone: c.phone })),
  };
}

module.exports = {
  createSegment, updateSegment, listSegments, getSegment, deleteSegment,
  resolveSegmentMembers, previewSegment,
};
