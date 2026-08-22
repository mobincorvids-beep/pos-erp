const { Schema, model } = require('mongoose');

const boqLineItemSchema = new Schema({
  description: { type: String, required: true }, // "Cement bags", "Steel rods"
  unit: String, // "bag", "rod", "day"
  estimatedQuantity: { type: Number, required: true },
  estimatedRate: { type: Number, required: true },
  estimatedAmount: { type: Number, required: true }, // estimatedQuantity * estimatedRate, computed at creation
  // Deliberately reuses the SAME enum ProjectCost.type already uses, so
  // a variance report can compare against REAL actual costs core Project
  // already tracks (auto-logged from approved Expenses and received
  // PurchaseOrders) without inventing a second, parallel cost-type taxonomy.
  costType: { type: String, required: true, enum: ['material', 'labor', 'expense', 'purchase', 'manual'] },
}, { _id: true });

// The genuinely new mechanic this module exists for: a real, PRE-APPROVED
// estimate created BEFORE a project's actual costs start accumulating —
// something core Project's existing profitability() function has no
// equivalent for. profitability() only ever looks at actual revenue vs.
// actual cost, grouped by type; there's no concept of "what we PLANNED to
// spend, line by line" anywhere in core to compare that reality against.
const billOfQuantitiesSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true },
  lineItems: { type: [boqLineItemSchema], required: true },
  totalEstimated: { type: Number, required: true },
}, { timestamps: true });

module.exports = model('BillOfQuantities', billOfQuantitiesSchema);
