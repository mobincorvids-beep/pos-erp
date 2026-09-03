const { Schema, model } = require('mongoose');

// One line of goods sent to (or received back from) a subcontractor.
// itemsSent and itemsReceived are separate arrays rather than one array with
// a "direction" flag because the received quantity for a product often
// legitimately differs from what was sent (wastage/shrinkage at the
// subcontractor's end) — keeping them apart makes that difference explicit
// and easy to report on, rather than something you have to reconstruct.
const subcontractItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
}, { _id: false });

// Job-work / subcontracting: goods (raw or semi-finished) sent out to a
// third-party supplier for an operation the company doesn't do in-house
// (e.g. raw fabric out for dyeing), tracked until finished/semi-finished
// goods come back. Deliberately lightweight — no stock movement is posted
// automatically (the goods usually stay on the books as company-owned
// stock-in-transit under existing inventory flows; wiring that in is a
// separate concern from just tracking the job) so this model can be added
// without touching InventoryService's movement types.
const subcontractOrderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  orderNumber: { type: String, required: true, unique: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true }, // the subcontractor/job-worker
  workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', default: null }, // optional link, e.g. dyeing a WO's intermediate output

  itemsSent: [subcontractItemSchema],
  itemsReceived: [subcontractItemSchema], // may be empty/partial until received back; quantities can differ from itemsSent (wastage)

  sentDate: { type: Date, required: true },
  expectedReturnDate: Date,
  actualReturnDate: Date,

  subcontractingCost: { type: Number, default: 0 }, // job-work charges payable to the subcontractor for this order

  status: { type: String, default: 'sent', enum: ['sent', 'partially_received', 'received', 'closed'] },
  note: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('SubcontractOrder', subcontractOrderSchema);
