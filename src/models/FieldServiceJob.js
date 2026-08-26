const { Schema, model } = require('mongoose');

const partUsedSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true }, // price charged to customer for this part, not its cost
}, { _id: false });

const checklistItemSchema = new Schema({
  item: { type: String, required: true },
  done: { type: Boolean, default: false },
}, { _id: false });

// Core module — a job performed at the CUSTOMER's own site by a dispatched
// technician (an HVAC repair at a customer's house, an on-site install, a
// field inspection). Distinct from ServiceOrder (in-shop job card, the item
// comes to you) and from MaintenanceWorkOrder (against the company's OWN
// asset). Follows the same "parts drawn from inventory immediately + labor
// billed via a dedicated Labor product" pattern as ServiceOrder.
const fieldServiceJobSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true }, // where parts are drawn from
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  siteAddress: { type: String, required: true }, // the customer's actual address — what makes this "field" not "in-shop"
  assignedTechnicianId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  scheduledAt: { type: Date, required: true },

  jobType: String, // "HVAC repair", "on-site installation", "field inspection"
  description: String,

  status: {
    type: String, default: 'scheduled',
    enum: ['scheduled', 'en_route', 'in_progress', 'completed', 'cancelled'],
  },

  checklist: [checklistItemSchema],

  partsUsed: [partUsedSchema],
  laborCharge: { type: Number, default: 0 },

  completionNotes: String,
  customerSignatureName: String, // simple "signed off by" field, not a real e-signature

  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // linked once billed
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // who created the dispatch
}, { timestamps: true });

fieldServiceJobSchema.index({ companyId: 1, assignedTechnicianId: 1, scheduledAt: 1 });
fieldServiceJobSchema.index({ companyId: 1, status: 1 });

module.exports = model('FieldServiceJob', fieldServiceJobSchema);
