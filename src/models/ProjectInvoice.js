const { Schema, model } = require('mongoose');

/**
 * A project billing event — a milestone invoice, or the later release of
 * retention held back on one. Kept as its own ledger rather than forced
 * through the product-line-item Sale/POS model: project billing is
 * "invoice this contract sum" (or a percentage/holdback of it), not "sell
 * these SKUs", and trying to represent that as fake Sale line items would
 * make Sale's own reporting (units sold, COGS, inventory) noisy with
 * entries that were never real product movements.
 */
const projectInvoiceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  milestoneId: { type: Schema.Types.ObjectId, ref: 'ProjectMilestone', default: null },

  invoiceNumber: { type: String, required: true },
  invoiceType: { type: String, default: 'milestone', enum: ['milestone', 'retention_release', 'wip_adjustment'] },

  grossAmount: { type: Number, required: true },
  retentionHeld: { type: Number, default: 0 }, // holdback withheld from this invoice, released later via a retention_release invoice
  netAmount: { type: Number, required: true }, // grossAmount - retentionHeld (what's actually due now)

  status: { type: String, default: 'issued', enum: ['draft', 'issued', 'paid'] },
  issuedAt: { type: Date, default: Date.now },
  paidAt: { type: Date, default: null },

  // Set on the ORIGINAL milestone invoice once its retention is released —
  // points at the retention_release ProjectInvoice that paid it out, so
  // "how much retention is still outstanding on this project" is a simple
  // query (sum retentionHeld where retentionReleasedInvoiceId is null).
  retentionReleasedInvoiceId: { type: Schema.Types.ObjectId, ref: 'ProjectInvoice', default: null },
}, { timestamps: true });

projectInvoiceSchema.index({ companyId: 1, projectId: 1 });
projectInvoiceSchema.index({ companyId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = model('ProjectInvoice', projectInvoiceSchema);
