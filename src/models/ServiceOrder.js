const { Schema, model } = require('mongoose');

const partUsedSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true }, // price charged to customer for this part, not its cost
}, { _id: false });

// Core module (not industry-specific) — powers Service Station, Workshop,
// Electronics Repair, and anywhere else a "job" involves parts + labor
// billed together, same as Appointments is core for anything calendar-based.
const serviceOrderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true }, // where parts are drawn from
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  // Optional — set when the Service Station industry module creates a job
  // card against a registered Vehicle. Core has no opinion on what a
  // vehicle is (same "tag a core document with an optional module-specific
  // reference" pattern Projects already established on Sale/Expense/
  // PurchaseOrder) — this just gives that module a way to link a job card
  // back to the vehicle it serviced, for service history and mileage-based due dates.
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null },
  assignedTechnicianId: { type: Schema.Types.ObjectId, ref: 'User' },

  itemDescription: { type: String, required: true }, // "iPhone 12 — screen repair", "Toyota Corolla — oil change"
  reportedIssue: String,
  diagnosisNote: String,

  status: {
    type: String, default: 'received',
    enum: ['received', 'diagnosed', 'in_progress', 'completed', 'delivered', 'cancelled'],
  },

  partsUsed: [partUsedSchema],
  laborCharge: { type: Number, default: 0 },

  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // linked once billed
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // who opened the job card
}, { timestamps: true });

module.exports = model('ServiceOrder', serviceOrderSchema);
