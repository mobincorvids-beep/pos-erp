const { Schema, model } = require('mongoose');

// One block of billable work — the genuinely new concept this module
// exists for. Nothing else in this app tracks "work done now, to be
// billed later in an aggregated batch" — every prior sale is billed at
// the moment of the transaction itself. A TimeEntry sits unbilled,
// possibly for weeks, accumulating alongside other entries for the same
// client, until someone actually generates an invoice that sweeps them
// all up together into one Sale.
const timeEntrySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  clientCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null }, // optional link into core Project/Job Costing, when the work is tied to a specific engagement
  date: { type: Date, default: Date.now },
  description: { type: String, required: true },
  hours: { type: Number, required: true },
  hourlyRate: { type: Number, required: true }, // snapshotted at entry time — a later rate change never retroactively reprices already-logged work
  billed: { type: Boolean, default: false },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // which invoice this entry ended up on, once billed
}, { timestamps: true });

timeEntrySchema.index({ companyId: 1, clientCustomerId: 1, billed: 1 });

module.exports = model('TimeEntry', timeEntrySchema);
