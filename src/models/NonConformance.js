const { Schema, model } = require('mongoose');

// Quality Management — Non-Conformance Report (NCR). Mirrors the
// "submit -> investigate -> act -> close" shape Ticket already proved,
// but for quality defects rather than support requests: a defective
// batch, a failed inspection, a customer complaint about product
// quality, or a supplier defect. An NCR can optionally reference a
// WorkOrder/Product/Supplier/Customer, but none of those are required —
// e.g. a customer complaint about a product with no manufacturing
// involvement is still a valid NCR.
const nonConformanceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  ncrNumber: { type: String, required: true },

  title: { type: String, required: true },
  description: { type: String, required: true },
  source: { type: String, required: true, enum: ['customer_complaint', 'internal_inspection', 'supplier_defect', 'production_defect', 'other'] },
  severity: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'] },
  status: { type: String, default: 'open', enum: ['open', 'investigating', 'corrective_action', 'closed'] },

  // Optional links to the real thing that went wrong — none required,
  // since an NCR can be a pure customer complaint with no manufacturing
  // record behind it at all.
  relatedProductId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
  relatedWorkOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
  relatedSupplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
  relatedCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },

  reportedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  // Filled in during investigation — the actual root cause, not just a status flip.
  rootCause: { type: String, default: null },

  closedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = model('NonConformance', nonConformanceSchema);
