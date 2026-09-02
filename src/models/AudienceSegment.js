const { Schema, model } = require('mongoose');

// A saved filter definition against Customer (and, for spend/purchase
// fields, an aggregation over Sale) — resolved on demand by
// marketingJourneyService.resolveSegmentMembers(), not materialized as a
// list of customer ids here. Kept deliberately flat: a list of conditions
// ANDed together (no nested groups / OR trees) — enough to express "VIP
// tag AND spent > 10000 in the last 90 days" without building a rules
// engine.
const conditionSchema = new Schema({
  field: {
    type: String,
    required: true,
    enum: ['tags', 'totalSpend', 'lastPurchaseDate', 'loyaltyTier'],
  },
  // tags: 'contains' (value = one tag string)
  // totalSpend: 'gte' | 'lte' (value = number)
  // lastPurchaseDate: 'before' | 'after' (value = ISO date string; "after" = purchased since that date, i.e. more recent than X; "before" = last purchase was before X, i.e. lapsed)
  // loyaltyTier: 'equals' (value = tier string, matched against LoyaltyTransaction-derived tier — see service)
  operator: { type: String, required: true, enum: ['contains', 'gte', 'lte', 'before', 'after', 'equals'] },
  value: { type: Schema.Types.Mixed, required: true },
}, { _id: false });

const audienceSegmentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  // All conditions must match (AND). Empty conditions = every customer in
  // the company.
  conditions: { type: [conditionSchema], default: [] },
}, { timestamps: true });

audienceSegmentSchema.index({ companyId: 1, name: 1 });

module.exports = model('AudienceSegment', audienceSegmentSchema);
