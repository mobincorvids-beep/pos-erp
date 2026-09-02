const { Schema, model } = require('mongoose');

const opportunitySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  // Nullable both ways deliberately: an opportunity can start from a Lead
  // (leadId set, customerId null until it's won) or be opened directly
  // against an existing Customer (customerId set, leadId null) — a repeat
  // buyer asking about a bigger order isn't a "lead", they're already a
  // customer with a new deal in progress.
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
  title: { type: String, required: true },
  estimatedValue: { type: Number, required: true, min: 0 },
  stage: { type: String, enum: ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'], default: 'new' },
  probability: { type: Number, min: 0, max: 100, default: 10 },
  expectedCloseDate: { type: Date, default: null },
  assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  lostReason: { type: String, default: '' },
  // Set when the deal is won and a real quotation-status Sale is created
  // for it via the existing sales-order pathway — this is the seam that
  // makes the pipeline connect to real Sales/Quotations, not a dead end.
  wonSaleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  // Set when a standalone quote is generated from this opportunity via the
  // "Generate quote" action — independent of stage/winning, unlike
  // wonSaleId which is only ever set the moment the deal is actually won.
  quoteSaleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

opportunitySchema.index({ companyId: 1, stage: 1 });

module.exports = model('Opportunity', opportunitySchema);
